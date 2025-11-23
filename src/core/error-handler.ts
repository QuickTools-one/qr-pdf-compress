import type { CompressionPreset, ProgressEvent } from '../api/types';
import { CompressionError } from '../api/types';
import { getFallbackPreset } from './presets';

/**
 * Error types that can occur during compression
 */
export enum ErrorType {
  INVALID_PDF = 'INVALID_PDF',
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  WASM_LOAD_FAILED = 'WASM_LOAD_FAILED',
  WORKER_ERROR = 'WORKER_ERROR',
  TIMEOUT = 'TIMEOUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Classifies an error based on its message and context
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();

  if (message.includes('invalid pdf') || message.includes('not a valid pdf')) {
    return ErrorType.INVALID_PDF;
  }

  if (
    message.includes('out of memory') ||
    message.includes('memory') ||
    message.includes('heap')
  ) {
    return ErrorType.OUT_OF_MEMORY;
  }

  if (message.includes('wasm') || message.includes('webassembly')) {
    return ErrorType.WASM_LOAD_FAILED;
  }

  if (message.includes('worker')) {
    return ErrorType.WORKER_ERROR;
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorType.TIMEOUT;
  }

  if (message.includes('validation') || message.includes('corrupt')) {
    return ErrorType.VALIDATION_FAILED;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Determines if an error is recoverable via graceful degradation
 */
export function isRecoverableError(errorType: ErrorType): boolean {
  switch (errorType) {
    case ErrorType.OUT_OF_MEMORY:
    case ErrorType.TIMEOUT:
    case ErrorType.WORKER_ERROR:
    case ErrorType.UNKNOWN:
      return true;
    case ErrorType.INVALID_PDF:
    case ErrorType.WASM_LOAD_FAILED:
    case ErrorType.VALIDATION_FAILED:
      return false;
  }
}

/**
 * Creates a user-friendly error message
 */
export function getUserFriendlyErrorMessage(errorType: ErrorType, preset: CompressionPreset): string {
  switch (errorType) {
    case ErrorType.INVALID_PDF:
      return 'The provided file is not a valid PDF or is corrupted.';
    case ErrorType.OUT_OF_MEMORY:
      return `Compression with ${preset} preset exceeded available memory. Try using a lighter preset or smaller chunk size.`;
    case ErrorType.WASM_LOAD_FAILED:
      return 'Failed to load the compression engine. Please check your internet connection and try again.';
    case ErrorType.WORKER_ERROR:
      return `Worker failed during ${preset} compression. This may be due to browser limitations.`;
    case ErrorType.TIMEOUT:
      return `Compression with ${preset} preset timed out. Try using a lighter preset or smaller chunk size.`;
    case ErrorType.VALIDATION_FAILED:
      return 'The compressed PDF failed validation. The file may be corrupted.';
    case ErrorType.UNKNOWN:
      return 'An unexpected error occurred during compression.';
  }
}

/**
 * Handles an error with graceful degradation if enabled
 */
export async function handleErrorWithGracefulDegradation(
  error: Error,
  currentPreset: CompressionPreset,
  gracefulDegradation: boolean,
  onProgress?: (event: ProgressEvent) => void
): Promise<{
  shouldRetry: boolean;
  nextPreset?: CompressionPreset;
  errorMessage?: string;
}> {
  const errorType = classifyError(error);
  const isRecoverable = isRecoverableError(errorType);

  // If error is not recoverable or graceful degradation is disabled, fail immediately
  if (!isRecoverable || !gracefulDegradation) {
    return {
      shouldRetry: false,
      errorMessage: getUserFriendlyErrorMessage(errorType, currentPreset),
    };
  }

  // Try to get fallback preset
  const fallbackPreset = getFallbackPreset(currentPreset);

  if (!fallbackPreset) {
    // No fallback available
    return {
      shouldRetry: false,
      errorMessage: `All compression presets failed. ${getUserFriendlyErrorMessage(errorType, currentPreset)}`,
    };
  }

  // Notify user of fallback
  if (onProgress) {
    onProgress({
      phase: 'error-recovery',
      progress: 0,
      message: `${currentPreset} compression failed (${errorType}). Trying ${fallbackPreset} preset...`,
    });
  }

  return {
    shouldRetry: true,
    nextPreset: fallbackPreset,
  };
}

/**
 * Creates a CompressionError from a generic error
 */
export function createCompressionError(
  error: Error,
  preset: CompressionPreset,
  originalSize: number,
  phase?: ProgressEvent['phase']
): CompressionError {
  const errorType = classifyError(error);
  const message = getUserFriendlyErrorMessage(errorType, preset);

  return new CompressionError(message, preset, originalSize, phase, error);
}

/**
 * Validates that a buffer is still valid (not detached)
 */
export function isValidBuffer(buffer: ArrayBuffer): boolean {
  try {
    new Uint8Array(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps a worker operation with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}
