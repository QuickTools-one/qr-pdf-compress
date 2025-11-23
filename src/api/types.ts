/**
 * Compression preset options
 * - lossless: Structural optimization only, no quality loss (5-30% reduction)
 * - balanced: Smart image compression, preserve vectors (30-70% reduction)
 * - max: Aggressive compression with optional rasterization (60-90% reduction)
 */
export type CompressionPreset = 'lossless' | 'balanced' | 'max';

/**
 * Progress event phases during compression
 */
export type ProgressPhase = 'chunking' | 'compressing' | 'merging' | 'error-recovery';

/**
 * Progress event emitted during compression
 */
export interface ProgressEvent {
  /** Current phase of compression */
  phase: ProgressPhase;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current chunk being processed (1-indexed) */
  currentChunk?: number;
  /** Total number of chunks */
  totalChunks?: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Optional message for error recovery or warnings */
  message?: string;
}

/**
 * Compression options
 */
export interface CompressionOptions {
  /** Compression preset to use */
  preset: CompressionPreset;
  /** Pages per chunk (default: 10) */
  chunkSize?: number;
  /** Progress callback function */
  onProgress?: (event: ProgressEvent) => void;
  /** Custom WASM URL (defaults to jsdelivr CDN) */
  wasmUrl?: string;
  /** Custom wasm_exec.js URL (defaults to jsdelivr CDN) */
  wasmExecUrl?: string;
  /** Enable graceful degradation (fallback to lighter presets on error, default: true) */
  gracefulDegradation?: boolean;
  /** Preserve metadata (default: true for lossless/balanced, false for max) */
  preserveMetadata?: boolean;
  /** Override target DPI for image downsampling (balanced/max only) */
  targetDPI?: number;
  /** Override JPEG quality (0-1, balanced/max only) */
  jpegQuality?: number;
  /** Enable rasterization in max mode (default: auto-detect) */
  enableRasterization?: boolean;
  /** Merge strategy: 'worker' (default) or 'main' thread */
  mergeStrategy?: 'worker' | 'main';
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

/**
 * Compression result
 */
export interface CompressionResult {
  /** Compressed PDF as ArrayBuffer */
  pdf: ArrayBuffer;
  /** Compression statistics */
  stats: CompressionStats;
  /** Warning message if graceful degradation occurred */
  warning?: string;
}

/**
 * Compression statistics
 */
export interface CompressionStats {
  /** Original PDF size in bytes */
  originalSize: number;
  /** Compressed PDF size in bytes */
  compressedSize: number;
  /** Compression ratio (0-1, where 0.5 means 50% of original size) */
  ratio: number;
  /** Bytes saved */
  bytesSaved: number;
  /** Percentage saved (0-100) */
  percentageSaved: number;
  /** Preset used (may differ from requested if graceful degradation occurred) */
  presetUsed: CompressionPreset;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Number of chunks processed */
  chunksProcessed: number;
}

/**
 * Custom error class for compression failures
 */
export class CompressionError extends Error {
  constructor(
    message: string,
    public attemptedPreset: CompressionPreset,
    public originalSize: number,
    public phase?: ProgressPhase,
    public underlyingError?: Error
  ) {
    super(message);
    this.name = 'CompressionError';
  }
}

/**
 * Worker message types
 */
export type WorkerMessageType =
  | 'compress-chunk'
  | 'chunk-complete'
  | 'merge-chunks'
  | 'merge-complete'
  | 'error'
  | 'progress';

/**
 * Message sent to compression worker
 */
export interface CompressChunkMessage {
  type: 'compress-chunk';
  chunkIndex: number;
  pdfData: ArrayBuffer;
  preset: CompressionPreset;
  options: {
    targetDPI?: number;
    jpegQuality?: number;
    preserveMetadata?: boolean;
    enableRasterization?: boolean;
  };
}

/**
 * Message received from compression worker
 */
export interface ChunkCompleteMessage {
  type: 'chunk-complete';
  chunkIndex: number;
  compressedPdf: ArrayBuffer;
  stats: {
    originalSize: number;
    compressedSize: number;
    processingTime: number;
  };
}

/**
 * Message sent to merge worker
 */
export interface MergeChunksMessage {
  type: 'merge-chunks';
  chunks: ArrayBuffer[];
  originalMetadata?: Record<string, any>;
}

/**
 * Message received from merge worker
 */
export interface MergeCompleteMessage {
  type: 'merge-complete';
  pdf: ArrayBuffer;
  stats: {
    originalSize: number;
    compressedSize: number;
    ratio: number;
  };
}

/**
 * Error message from worker
 */
export interface WorkerErrorMessage {
  type: 'error';
  error: string;
  phase?: ProgressPhase;
}

/**
 * Progress message from worker
 */
export interface WorkerProgressMessage {
  type: 'progress';
  progress: number;
  message?: string;
}

/**
 * Union type for all worker messages
 */
export type WorkerMessage =
  | CompressChunkMessage
  | ChunkCompleteMessage
  | MergeChunksMessage
  | MergeCompleteMessage
  | WorkerErrorMessage
  | WorkerProgressMessage;
