/**
 * @quicktoolsone/pdf-compress
 * Simple, clean PDF compression library
 */

// Main API
export { compress, compressLossless, compressBalanced, compressMax } from './compress';

// Types
export type {
  CompressionPreset,
  CompressionOptions,
  CompressionResult,
  CompressionStats,
  ProgressEvent,
  ProgressPhase,
} from './types';

export { CompressionError } from './types';
