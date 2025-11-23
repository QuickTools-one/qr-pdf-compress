/**
 * QR-PDF-Compress
 * Client-side PDF compression library using WebAssembly
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

// Presets (for reference)
export { PRESETS, getPresetConfig } from '../core/presets';
