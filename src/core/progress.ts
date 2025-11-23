import type { ProgressEvent, ProgressPhase } from '../api/types';

/**
 * Progress tracker for aggregating and reporting compression progress
 */
export class ProgressTracker {
  private totalChunks: number = 0;
  private completedChunks: number = 0;
  private currentPhase: ProgressPhase = 'chunking';
  private startTime: number = Date.now();
  private chunkTimes: number[] = [];
  private onProgress?: (event: ProgressEvent) => void;

  constructor(onProgress?: (event: ProgressEvent) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Sets the total number of chunks
   */
  setTotalChunks(total: number): void {
    this.totalChunks = total;
  }

  /**
   * Sets the current phase
   */
  setPhase(phase: ProgressPhase): void {
    this.currentPhase = phase;
    this.emitProgress();
  }

  /**
   * Reports progress for the chunking phase
   */
  reportChunkingProgress(progress: number): void {
    this.currentPhase = 'chunking';
    this.emit({
      phase: 'chunking',
      progress,
    });
  }

  /**
   * Reports that a chunk compression has started
   */
  startChunk(chunkIndex: number): void {
    this.currentPhase = 'compressing';
    this.emit({
      phase: 'compressing',
      progress: this.calculateProgress(),
      currentChunk: chunkIndex + 1,
      totalChunks: this.totalChunks,
    });
  }

  /**
   * Reports that a chunk compression has completed
   */
  completeChunk(chunkIndex: number, processingTime: number): void {
    this.completedChunks++;
    this.chunkTimes.push(processingTime);

    this.emit({
      phase: 'compressing',
      progress: this.calculateProgress(),
      currentChunk: chunkIndex + 1,
      totalChunks: this.totalChunks,
      estimatedTimeRemaining: this.estimateTimeRemaining(),
    });
  }

  /**
   * Reports merging progress
   */
  reportMergingProgress(progress: number): void {
    this.currentPhase = 'merging';
    this.emit({
      phase: 'merging',
      progress: Math.min(95, 90 + progress * 0.1), // Merging is final 10%
    });
  }

  /**
   * Reports completion
   */
  reportComplete(): void {
    this.emit({
      phase: 'merging',
      progress: 100,
    });
  }

  /**
   * Reports error recovery
   */
  reportErrorRecovery(message: string): void {
    this.emit({
      phase: 'error-recovery',
      progress: this.calculateProgress(),
      message,
    });
  }

  /**
   * Calculates overall progress percentage
   */
  private calculateProgress(): number {
    if (this.totalChunks === 0) return 0;

    // Chunking: 0-10%
    // Compressing: 10-90% (main work)
    // Merging: 90-100%

    switch (this.currentPhase) {
      case 'chunking':
        return 5; // Chunking is quick

      case 'compressing': {
        const compressionProgress = this.completedChunks / this.totalChunks;
        return 10 + compressionProgress * 80; // 10-90%
      }

      case 'merging':
        return 95; // Merging is final step

      case 'error-recovery':
        return this.completedChunks / this.totalChunks * 90;

      default:
        return 0;
    }
  }

  /**
   * Estimates remaining time based on average chunk processing time
   */
  private estimateTimeRemaining(): number | undefined {
    if (this.chunkTimes.length === 0 || this.completedChunks >= this.totalChunks) {
      return undefined;
    }

    const avgChunkTime = this.chunkTimes.reduce((a, b) => a + b, 0) / this.chunkTimes.length;
    const remainingChunks = this.totalChunks - this.completedChunks;
    return Math.ceil(avgChunkTime * remainingChunks);
  }

  /**
   * Emits a progress event
   */
  private emitProgress(): void {
    this.emit({
      phase: this.currentPhase,
      progress: this.calculateProgress(),
      currentChunk: this.completedChunks + 1,
      totalChunks: this.totalChunks,
      estimatedTimeRemaining: this.estimateTimeRemaining(),
    });
  }

  /**
   * Emits a progress event to the callback
   */
  private emit(event: ProgressEvent): void {
    if (this.onProgress) {
      this.onProgress(event);
    }
  }

  /**
   * Gets elapsed time since start
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
}
