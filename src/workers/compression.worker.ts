/**
 * Compression Worker
 *
 * Handles per-chunk PDF compression using WASM
 * Each worker instance:
 * 1. Receives a chunk of pages
 * 2. Loads WASM (or uses cached)
 * 3. Compresses the chunk
 * 4. Returns compressed mini-PDF
 * 5. Terminates
 */

import type {
  CompressChunkMessage,
  ChunkCompleteMessage,
  WorkerErrorMessage,
  WorkerProgressMessage,
} from '../api/types';
import { loadWASM } from '../wasm/loader';
import { compressPDFWithWASM } from '../wasm/pdfcpu-adapter';

// Worker message handler
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'compress-chunk') {
    await handleCompressChunk(message as CompressChunkMessage);
  }
};

/**
 * Handles chunk compression
 */
async function handleCompressChunk(message: CompressChunkMessage): Promise<void> {
  const startTime = Date.now();
  const { chunkIndex, pdfData, preset, options } = message;

  try {
    // Report progress: Loading WASM
    postProgress(10, 'Loading compression engine...');

    // Load WASM if not already loaded
    // Note: In production, wasmUrl would be passed in the message
    await loadWASM();

    // Report progress: Compressing
    postProgress(30, `Compressing chunk ${chunkIndex + 1}...`);

    // Compress the chunk using WASM
    const compressedPdf = await compressPDFWithWASM(pdfData, {
      preset,
      ...options,
    });

    // Report progress: Complete
    postProgress(100, 'Chunk compression complete');

    // Calculate stats
    const processingTime = Date.now() - startTime;
    const stats = {
      originalSize: pdfData.byteLength,
      compressedSize: compressedPdf.byteLength,
      processingTime,
    };

    // Send result back to main thread
    const response: ChunkCompleteMessage = {
      type: 'chunk-complete',
      chunkIndex,
      compressedPdf,
      stats,
    };

    // Use transferable to avoid copying
    self.postMessage(response, [compressedPdf]);
  } catch (error) {
    // Send error back to main thread
    const errorMessage: WorkerErrorMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown compression error',
      phase: 'compressing',
    };

    self.postMessage(errorMessage);
  }
}

/**
 * Posts progress update to main thread
 */
function postProgress(progress: number, message?: string): void {
  const progressMessage: WorkerProgressMessage = {
    type: 'progress',
    progress,
    message,
  };

  self.postMessage(progressMessage);
}

// Handle worker errors
self.onerror = (event: string | Event) => {
  const errorMessage: WorkerErrorMessage = {
    type: 'error',
    error: typeof event === 'string' ? event : ((event as ErrorEvent).message || 'Worker error'),
    phase: 'compressing',
  };

  self.postMessage(errorMessage);
};
