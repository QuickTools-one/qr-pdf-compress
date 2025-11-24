/**
 * PDF Compression using pdf-lib + pdf.js
 *
 * Multi-strategy approach from QuickTools.one:
 * 1. Try lossless optimization (structural compression)
 * 2. If insufficient, render pages to images with pdf.js and compress with JPEG
 * 3. Choose the smallest result
 */

import { PDFDocument } from 'pdf-lib';
import type { CompressionPreset, CompressionResult, CompressionOptions, ProgressEvent } from '../api/types';

/**
 * Gets JPEG quality based on compression preset
 */
function getCompressionQuality(preset: CompressionPreset): number {
  switch (preset) {
    case 'lossless': return 1.0; // No image compression for lossless
    case 'balanced': return 0.7; // Balanced (sweet spot)
    case 'max': return 0.5; // High compression
    default: return 0.7;
  }
}

/**
 * Compresses a PDF using multi-strategy approach
 */
export async function compressPDF(
  pdfBuffer: ArrayBuffer,
  options: CompressionOptions
): Promise<CompressionResult> {
  const startTime = Date.now();
  const originalSize = pdfBuffer.byteLength;
  const preset = options.preset;

  console.log(`[Compressor] Starting compression with preset: ${preset}`);
  console.log(`[Compressor] File size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  emitProgress(options.onProgress, {
    phase: 'compressing',
    progress: 0,
    message: 'Loading PDF...',
  });

  try {
    // Load the original PDF
    const originalPdf = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    const numPages = originalPdf.getPageCount();

    emitProgress(options.onProgress, {
      phase: 'compressing',
      progress: 20,
      message: 'Optimizing PDF structure...',
    });

    // Strategy 1: Lossless optimization (good for text-heavy PDFs)
    const optimizedPdfBytes = await originalPdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const optimizedSize = optimizedPdfBytes.length;

    emitProgress(options.onProgress, {
      phase: 'compressing',
      progress: 40,
      message: `Lossless optimization: ${((1 - optimizedSize / originalSize) * 100).toFixed(1)}% reduction`,
    });

    // ONLY return early for lossless preset
    // For balanced/max presets, ALWAYS try image compression for better results
    if (preset === 'lossless') {
      // Lossless preset requested - return structural optimization only
      console.log(`[Compressor] Lossless preset - returning early with ${((1 - optimizedSize / originalSize) * 100).toFixed(1)}% reduction`);
      const processingTime = Date.now() - startTime;
      const bytesSaved = originalSize - optimizedSize;
      const percentageSaved = (bytesSaved / originalSize) * 100;

      emitProgress(options.onProgress, {
        phase: 'compressing',
        progress: 100,
        message: 'Lossless compression complete',
      });

      return {
        pdf: optimizedPdfBytes.buffer as ArrayBuffer,
        stats: {
          originalSize,
          compressedSize: optimizedSize,
          ratio: optimizedSize / originalSize,
          bytesSaved,
          percentageSaved,
          presetUsed: preset,
          processingTime,
          chunksProcessed: 1,
        },
      };
    }

    // For balanced/max: ALWAYS proceed to image compression
    console.log(`[Compressor] Preset "${preset}" - proceeding to image compression (lossless saved ${((1 - optimizedSize / originalSize) * 100).toFixed(1)}%, but will try for more)`);

    // Strategy 2: Image compression for image-heavy PDFs
    emitProgress(options.onProgress, {
      phase: 'compressing',
      progress: 45,
      message: 'Starting image compression...',
    });

    const quality = getCompressionQuality(preset);
    const isLargeFile = originalSize > 20 * 1024 * 1024; // 20MB threshold
    const isVeryLargeFile = originalSize > 50 * 1024 * 1024; // 50MB threshold

    // Calculate target DPI and quality based on file size AND preset
    let TARGET_DPI: number;
    let imageQuality: number;

    if (isVeryLargeFile) {
      // 50MB+ files: Very aggressive to prevent crashes, but balanced is less aggressive
      TARGET_DPI = preset === 'max' ? 50 : 75; // balanced uses higher DPI = better quality
      imageQuality = preset === 'max' ? Math.min(quality, 0.35) : Math.min(quality, 0.50); // balanced keeps more quality
    } else if (isLargeFile) {
      // 20-50MB files: Clear difference between presets
      TARGET_DPI = preset === 'max' ? 72 : 120; // balanced uses much higher DPI
      imageQuality = preset === 'max' ? quality * 0.75 : quality; // balanced uses full preset quality
    } else if (originalSize > 10 * 1024 * 1024) {
      // 10-20MB files: Full quality difference
      TARGET_DPI = preset === 'max' ? 100 : 150;
      imageQuality = quality; // Use preset quality as-is
    } else {
      // <10MB files: Maximum quality difference
      TARGET_DPI = preset === 'max' ? 120 : 150;
      imageQuality = quality;
    }

    console.log(`[Compressor] Image compression settings: DPI=${TARGET_DPI}, quality=${imageQuality}, preset quality=${quality}`);

    // Create new PDF for image compression
    const compressedPdf = await PDFDocument.create();

    // Dynamically import PDF.js
    const pdfjsLib = await import('pdfjs-dist');

    // Configure worker - try to use local worker first, fall back to CDN
    if (typeof window !== 'undefined') {
      try {
        // Try local worker first
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.js/pdf.worker.min.mjs';
      } catch {
        // Fall back to CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }
    }

    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdfDocument = await loadingTask.promise;

    // Process each page sequentially
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const progressPercent = 45 + ((pageNum / numPages) * 45);
      emitProgress(options.onProgress, {
        phase: 'compressing',
        progress: Math.round(progressPercent),
        message: `Compressing page ${pageNum}/${numPages}...`,
      });

      // Get page from PDF.js
      const page = await pdfDocument.getPage(pageNum);

      // Get original dimensions (PDF.js uses 72 DPI by default)
      const originalViewport = page.getViewport({ scale: 1.0 });

      // Calculate scale to achieve target DPI
      const baseDPI = 72;
      let scale = Math.min(TARGET_DPI / baseDPI, 2.5);

      // Calculate canvas dimensions
      let canvasWidth = Math.floor(originalViewport.width * scale);
      let canvasHeight = Math.floor(originalViewport.height * scale);

      // Limit canvas size to prevent memory issues
      const MAX_DIMENSION = isVeryLargeFile ? 1536 : isLargeFile ? 2560 : 4096;
      if (canvasWidth > MAX_DIMENSION || canvasHeight > MAX_DIMENSION) {
        const widthScale = MAX_DIMENSION / canvasWidth;
        const heightScale = MAX_DIMENSION / canvasHeight;
        const limitScale = Math.min(widthScale, heightScale);
        scale *= limitScale;
        canvasWidth = Math.floor(originalViewport.width * scale);
        canvasHeight = Math.floor(originalViewport.height * scale);
      }

      const viewport = page.getViewport({ scale });

      // Create canvas (browser only)
      if (typeof document === 'undefined') {
        throw new Error('Image compression requires a browser environment');
      }

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: false,
      });
      if (!context) throw new Error('Failed to get canvas context');

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Render PDF page to canvas
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
      }).promise;

      // Convert canvas to JPEG
      const jpegDataUrl = canvas.toDataURL('image/jpeg', imageQuality);
      const base64Data = jpegDataUrl.split(',')[1];
      const jpegBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Embed JPEG in new PDF with original dimensions
      const jpegImage = await compressedPdf.embedJpg(jpegBytes);
      const newPage = compressedPdf.addPage([originalViewport.width, originalViewport.height]);

      newPage.drawImage(jpegImage, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });

      // Clean up canvas
      canvas.width = 0;
      canvas.height = 0;
      context.clearRect(0, 0, 1, 1);

      // Allow UI updates and garbage collection
      const delayMs = isVeryLargeFile ? 100 : isLargeFile ? 50 : 10;
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Force cleanup every 10 pages for very large files
      if (isVeryLargeFile && pageNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    emitProgress(options.onProgress, {
      phase: 'compressing',
      progress: 90,
      message: 'Finalizing compression...',
    });

    // Save image-compressed PDF
    const imageCompressedBytes = await compressedPdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const imageCompressedSize = imageCompressedBytes.length;

    emitProgress(options.onProgress, {
      phase: 'compressing',
      progress: 95,
      message: `Image compression: ${((1 - imageCompressedSize / originalSize) * 100).toFixed(1)}% reduction`,
    });

    // Strategy 3: Choose the smallest result
    let finalSize: number;
    let finalBytes: Uint8Array;

    if (imageCompressedSize < optimizedSize && imageCompressedSize < originalSize) {
      // Image compression worked best
      finalSize = imageCompressedSize;
      finalBytes = imageCompressedBytes;
    } else if (optimizedSize < originalSize) {
      // Lossless optimization was better
      finalSize = optimizedSize;
      finalBytes = optimizedPdfBytes;
    } else {
      // Neither method reduced size, use original
      finalSize = originalSize;
      finalBytes = new Uint8Array(pdfBuffer);
    }

    const processingTime = Date.now() - startTime;
    const bytesSaved = originalSize - finalSize;
    const percentageSaved = (bytesSaved / originalSize) * 100;

    emitProgress(options.onProgress, {
      phase: 'compressing',
      progress: 100,
      message: 'Compression complete',
    });

    return {
      pdf: finalBytes.buffer as ArrayBuffer,
      stats: {
        originalSize,
        compressedSize: finalSize,
        ratio: finalSize / originalSize,
        bytesSaved,
        percentageSaved,
        presetUsed: preset,
        processingTime,
        chunksProcessed: 1,
      },
    };
  } catch (error) {
    throw new Error(
      `PDF compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Helper to emit progress events
 */
function emitProgress(
  onProgress: ((event: ProgressEvent) => void) | undefined,
  event: ProgressEvent
): void {
  if (onProgress) {
    onProgress(event);
  }
}
