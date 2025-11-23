/**
 * Merge Worker
 *
 * Handles merging compressed PDF chunks into a final PDF
 * This runs in a separate worker to avoid blocking the main thread
 */

import type {
  MergeChunksMessage,
  MergeCompleteMessage,
  WorkerErrorMessage,
  WorkerProgressMessage,
} from '../api/types';
import { mergePDFs } from '../utils/pdf-utils';

// Worker message handler
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'merge-chunks') {
    await handleMergeChunks(message as MergeChunksMessage);
  }
};

/**
 * Handles merging PDF chunks
 */
async function handleMergeChunks(message: MergeChunksMessage): Promise<void> {
  const { chunks, originalMetadata } = message;

  try {
    postProgress(10, 'Preparing to merge chunks...');

    // Calculate total size
    const totalOriginalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

    postProgress(30, `Merging ${chunks.length} chunks...`);

    // Merge all chunks using pdf-lib
    const mergedPdf = await mergePDFs(chunks, originalMetadata);

    postProgress(90, 'Finalizing merged PDF...');

    // Calculate stats
    const stats = {
      originalSize: totalOriginalSize,
      compressedSize: mergedPdf.byteLength,
      ratio: mergedPdf.byteLength / totalOriginalSize,
    };

    postProgress(100, 'Merge complete');

    // Send result back to main thread
    const response: MergeCompleteMessage = {
      type: 'merge-complete',
      pdf: mergedPdf,
      stats,
    };

    // Use transferable to avoid copying
    self.postMessage(response, [mergedPdf]);
  } catch (error) {
    // Send error back to main thread
    const errorMessage: WorkerErrorMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown merge error',
      phase: 'merging',
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
    phase: 'merging',
  };

  self.postMessage(errorMessage);
};
