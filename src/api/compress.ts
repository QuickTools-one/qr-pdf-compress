/**
 * Main compression API
 */

import type { CompressionOptions, CompressionResult, CompressionPreset } from './types';
import { CompressionError } from './types';
import { orchestrateCompression } from '../core/orchestrator';
import { loadWASM } from '../wasm/loader';

/**
 * Compresses a PDF file using the specified preset and options
 *
 * @param pdfBuffer - The PDF file as an ArrayBuffer
 * @param options - Compression options
 * @returns Promise resolving to the compressed PDF and statistics
 *
 * @example
 * ```typescript
 * import { compress } from 'qr-pdf-compress';
 *
 * const file = await fetch('document.pdf').then(r => r.arrayBuffer());
 * const result = await compress(file, {
 *   preset: 'balanced',
 *   onProgress: (event) => {
 *     console.log(`${event.phase}: ${event.progress}%`);
 *   }
 * });
 *
 * console.log(`Saved ${result.stats.percentageSaved.toFixed(1)}%`);
 * ```
 */
export async function compress(
  pdfBuffer: ArrayBuffer,
  options: Partial<CompressionOptions> = {}
): Promise<CompressionResult> {
  // Validate input
  if (!(pdfBuffer instanceof ArrayBuffer)) {
    throw new TypeError('pdfBuffer must be an ArrayBuffer');
  }

  if (pdfBuffer.byteLength === 0) {
    throw new CompressionError('Empty PDF buffer', 'lossless', 0);
  }

  // Set defaults
  const fullOptions: CompressionOptions = {
    preset: options.preset || 'balanced',
    chunkSize: options.chunkSize,
    onProgress: options.onProgress,
    wasmUrl: options.wasmUrl,
    gracefulDegradation: options.gracefulDegradation !== false,
    preserveMetadata: options.preserveMetadata,
    targetDPI: options.targetDPI,
    jpegQuality: options.jpegQuality,
    enableRasterization: options.enableRasterization,
    mergeStrategy: options.mergeStrategy || 'worker',
    timeout: options.timeout || 300000, // 5 minutes
  };

  // Validate preset
  if (!['lossless', 'balanced', 'max'].includes(fullOptions.preset)) {
    throw new TypeError(`Invalid preset: ${fullOptions.preset}. Must be 'lossless', 'balanced', or 'max'.`);
  }

  // Load WASM module (lazy load on first use)
  if (fullOptions.onProgress) {
    fullOptions.onProgress({
      phase: 'chunking',
      progress: 0,
      message: 'Initializing compression engine...',
    });
  }

  try {
    // Load WASM (will use cached if already loaded)
    await loadWASM(fullOptions.wasmUrl);
  } catch (error) {
    throw new CompressionError(
      'Failed to load compression engine',
      fullOptions.preset,
      pdfBuffer.byteLength,
      'chunking',
      error instanceof Error ? error : undefined
    );
  }

  // Start compression
  return await orchestrateCompression(pdfBuffer, fullOptions);
}

/**
 * Compresses a PDF with the lossless preset
 * Convenience wrapper around compress()
 *
 * @param pdfBuffer - The PDF file as an ArrayBuffer
 * @param options - Additional compression options (preset will be overridden)
 */
export async function compressLossless(
  pdfBuffer: ArrayBuffer,
  options: Omit<Partial<CompressionOptions>, 'preset'> = {}
): Promise<CompressionResult> {
  return compress(pdfBuffer, { ...options, preset: 'lossless' });
}

/**
 * Compresses a PDF with the balanced preset (recommended)
 * Convenience wrapper around compress()
 *
 * @param pdfBuffer - The PDF file as an ArrayBuffer
 * @param options - Additional compression options (preset will be overridden)
 */
export async function compressBalanced(
  pdfBuffer: ArrayBuffer,
  options: Omit<Partial<CompressionOptions>, 'preset'> = {}
): Promise<CompressionResult> {
  return compress(pdfBuffer, { ...options, preset: 'balanced' });
}

/**
 * Compresses a PDF with the max preset
 * Convenience wrapper around compress()
 *
 * @param pdfBuffer - The PDF file as an ArrayBuffer
 * @param options - Additional compression options (preset will be overridden)
 */
export async function compressMax(
  pdfBuffer: ArrayBuffer,
  options: Omit<Partial<CompressionOptions>, 'preset'> = {}
): Promise<CompressionResult> {
  return compress(pdfBuffer, { ...options, preset: 'max' });
}
