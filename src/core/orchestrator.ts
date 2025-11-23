/**
 * Core Orchestrator
 *
 * Manages the PDF compression workflow:
 * 1. Validates input PDF
 * 2. Chunks PDF into page ranges
 * 3. Spawns workers for each chunk
 * 4. Collects compressed chunks
 * 5. Merges chunks into final PDF
 * 6. Handles graceful degradation
 */

import type {
  CompressionOptions,
  CompressionResult,
  CompressionStats,
  CompressChunkMessage,
  ChunkCompleteMessage,
  MergeChunksMessage,
  MergeCompleteMessage,
  WorkerMessage,
} from '../api/types';
import { CompressionError } from '../api/types';
import { ProgressTracker } from './progress';
import { getPresetConfigWithOverrides, getPresetFallbackChain } from './presets';
import { handleErrorWithGracefulDegradation } from './error-handler';
import { isValidPDF, countPages, extractPages, extractMetadata, calculateChunkSize } from '../utils/pdf-utils';
import { clearBuffers, terminateWorker } from '../utils/memory';

/**
 * Orchestrates the entire compression process
 */
export async function orchestrateCompression(
  pdfBuffer: ArrayBuffer,
  options: CompressionOptions
): Promise<CompressionResult> {
  const startTime = Date.now();
  const originalSize = pdfBuffer.byteLength;

  // Validate PDF
  if (!isValidPDF(pdfBuffer)) {
    throw new CompressionError('Invalid PDF file', options.preset, originalSize);
  }

  // Get preset fallback chain for graceful degradation
  const presetChain = options.gracefulDegradation !== false
    ? getPresetFallbackChain(options.preset)
    : [options.preset];

  let lastError: Error | null = null;

  // Try each preset in the chain
  for (const preset of presetChain) {
    try {
      const result = await compressWithPreset(pdfBuffer, {
        ...options,
        preset,
      });

      // Calculate final stats
      const processingTime = Date.now() - startTime;
      const stats: CompressionStats = {
        ...result.stats,
        processingTime,
        presetUsed: preset,
      };

      return {
        pdf: result.pdf,
        stats,
        warning: preset !== options.preset
          ? `Original preset '${options.preset}' failed, used '${preset}' instead.`
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // If this is the last preset in the chain, throw
      if (preset === presetChain[presetChain.length - 1]) {
        break;
      }

      // Report fallback
      if (options.onProgress) {
        const fallbackResult = await handleErrorWithGracefulDegradation(
          lastError,
          preset,
          true,
          options.onProgress
        );

        if (!fallbackResult.shouldRetry) {
          break;
        }
      }
    }
  }

  // All presets failed, return original PDF
  if (options.gracefulDegradation !== false) {
    if (options.onProgress) {
      options.onProgress({
        phase: 'error-recovery',
        progress: 100,
        message: 'All compression attempts failed. Returning original PDF.',
      });
    }

    return {
      pdf: pdfBuffer.slice(0), // Return a copy
      stats: {
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        bytesSaved: 0,
        percentageSaved: 0,
        presetUsed: options.preset,
        processingTime: Date.now() - startTime,
        chunksProcessed: 0,
      },
      warning: 'Compression failed. Returning original PDF.',
    };
  }

  // Throw the last error
  throw lastError || new CompressionError('Compression failed', options.preset, originalSize);
}

/**
 * Compresses PDF with a specific preset
 */
async function compressWithPreset(
  pdfBuffer: ArrayBuffer,
  options: CompressionOptions
): Promise<{ pdf: ArrayBuffer; stats: Omit<CompressionStats, 'processingTime' | 'presetUsed'> }> {
  const progress = new ProgressTracker(options.onProgress);

  // Count pages
  progress.setPhase('chunking');
  const totalPages = await countPages(pdfBuffer);

  // Calculate chunk size
  const chunkSize = options.chunkSize || calculateChunkSize(totalPages, pdfBuffer.byteLength);
  const numChunks = Math.ceil(totalPages / chunkSize);

  progress.setTotalChunks(numChunks);
  progress.reportChunkingProgress(50);

  // Extract metadata if preserving
  const presetConfig = getPresetConfigWithOverrides(options.preset, {
    targetDPI: options.targetDPI,
    jpegQuality: options.jpegQuality,
    preserveMetadata: options.preserveMetadata,
    enableRasterization: options.enableRasterization,
  });

  const metadata = presetConfig.preserveMetadata
    ? await extractMetadata(pdfBuffer)
    : undefined;

  progress.reportChunkingProgress(100);

  // Process chunks
  const compressedChunks: ArrayBuffer[] = [];
  const chunkStats: Array<{ originalSize: number; compressedSize: number }> = [];

  for (let i = 0; i < numChunks; i++) {
    const startPage = i * chunkSize;
    const endPage = Math.min((i + 1) * chunkSize, totalPages);

    // Extract chunk
    const chunkPdf = await extractPages(pdfBuffer, startPage, endPage);

    // Compress chunk
    progress.startChunk(i);
    const compressed = await compressChunk(chunkPdf, options, i);

    chunkStats.push({
      originalSize: chunkPdf.byteLength,
      compressedSize: compressed.byteLength,
    });

    compressedChunks.push(compressed);
    progress.completeChunk(i, compressed.byteLength);
  }

  // Merge chunks
  progress.setPhase('merging');
  const mergedPdf = await mergeChunks(compressedChunks, metadata, options, progress);

  // Calculate stats
  const totalOriginalSize = chunkStats.reduce((sum, s) => sum + s.originalSize, 0);
  const totalCompressedSize = mergedPdf.byteLength;
  const ratio = totalCompressedSize / totalOriginalSize;
  const bytesSaved = totalOriginalSize - totalCompressedSize;
  const percentageSaved = (bytesSaved / totalOriginalSize) * 100;

  progress.reportComplete();

  // Cleanup
  clearBuffers(compressedChunks);

  return {
    pdf: mergedPdf,
    stats: {
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      ratio,
      bytesSaved,
      percentageSaved,
      chunksProcessed: numChunks,
    },
  };
}

/**
 * Compresses a single chunk using a worker
 */
async function compressChunk(
  chunkPdf: ArrayBuffer,
  options: CompressionOptions,
  chunkIndex: number
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    // Create worker from blob URL to avoid bundling issues
    const workerBlob = new Blob([getCompressionWorkerCode()], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl, { type: 'module' });

    // Set up message handler
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === 'chunk-complete') {
        const result = message as ChunkCompleteMessage;
        terminateWorker(worker);
        URL.revokeObjectURL(workerUrl);
        resolve(result.compressedPdf);
      } else if (message.type === 'error') {
        terminateWorker(worker);
        URL.revokeObjectURL(workerUrl);
        reject(new Error(message.error));
      }
      // Ignore progress messages from worker (we track at orchestrator level)
    };

    worker.onerror = (error) => {
      terminateWorker(worker);
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Worker error: ${error.message}`));
    };

    // Send compression task
    const message: CompressChunkMessage = {
      type: 'compress-chunk',
      chunkIndex,
      pdfData: chunkPdf,
      preset: options.preset,
      options: {
        targetDPI: options.targetDPI,
        jpegQuality: options.jpegQuality,
        preserveMetadata: options.preserveMetadata,
        enableRasterization: options.enableRasterization,
      },
    };

    worker.postMessage(message, [chunkPdf]); // Transfer buffer

    // Add timeout
    const timeout = options.timeout || 300000; // 5 minutes default
    setTimeout(() => {
      terminateWorker(worker);
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Chunk ${chunkIndex} compression timed out after ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Merges compressed chunks using a worker
 */
async function mergeChunks(
  chunks: ArrayBuffer[],
  metadata: Record<string, any> | undefined,
  options: CompressionOptions,
  progress: ProgressTracker
): Promise<ArrayBuffer> {
  // If merge strategy is 'main' or only one chunk, merge in main thread
  if (options.mergeStrategy === 'main' || chunks.length === 1) {
    if (chunks.length === 1) {
      return chunks[0];
    }

    // Use pdf-lib directly in main thread
    const { mergePDFs } = await import('../utils/pdf-utils');
    return await mergePDFs(chunks, metadata);
  }

  // Otherwise, use worker
  return new Promise((resolve, reject) => {
    const workerBlob = new Blob([getMergeWorkerCode()], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl, { type: 'module' });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === 'merge-complete') {
        const result = message as MergeCompleteMessage;
        terminateWorker(worker);
        URL.revokeObjectURL(workerUrl);
        resolve(result.pdf);
      } else if (message.type === 'error') {
        terminateWorker(worker);
        URL.revokeObjectURL(workerUrl);
        reject(new Error(message.error));
      } else if (message.type === 'progress') {
        progress.reportMergingProgress(message.progress);
      }
    };

    worker.onerror = (error) => {
      terminateWorker(worker);
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Merge worker error: ${error.message}`));
    };

    const message: MergeChunksMessage = {
      type: 'merge-chunks',
      chunks,
      originalMetadata: metadata,
    };

    // Note: chunks are transferred, so they'll be neutered in main thread
    const transferList = chunks.filter((c) => c.byteLength > 0);
    worker.postMessage(message, transferList);
  });
}

/**
 * Returns the compression worker code as a string
 * This is a workaround since we can't easily bundle workers
 */
function getCompressionWorkerCode(): string {
  // In production, this would be the actual worker code
  // For now, we'll return a placeholder
  return `
    // Compression worker code will be injected here during build
    console.log('Compression worker loaded');
    self.postMessage({ type: 'error', error: 'Worker not implemented yet' });
  `;
}

/**
 * Returns the merge worker code as a string
 */
function getMergeWorkerCode(): string {
  // In production, this would be the actual worker code
  return `
    // Merge worker code will be injected here during build
    console.log('Merge worker loaded');
    self.postMessage({ type: 'error', error: 'Worker not implemented yet' });
  `;
}
