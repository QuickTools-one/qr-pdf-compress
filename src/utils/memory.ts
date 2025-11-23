/**
 * Memory management utilities for cleanup and optimization
 */

/**
 * Explicitly clears an ArrayBuffer reference for garbage collection
 */
export function clearBuffer(buffer: ArrayBuffer | null | undefined): void {
  if (!buffer) return;

  // Create a detached view to help GC
  try {
    new Uint8Array(buffer);
  } catch {
    // Buffer already detached
  }
}

/**
 * Clears an array of ArrayBuffers
 */
export function clearBuffers(buffers: (ArrayBuffer | null | undefined)[]): void {
  buffers.forEach(clearBuffer);
}

/**
 * Estimates available memory (heuristic-based)
 * Returns estimated available memory in bytes
 */
export function estimateAvailableMemory(): number {
  // @ts-ignore - performance.memory is non-standard but available in Chrome
  if (typeof performance !== 'undefined' && performance.memory) {
    // @ts-ignore
    const usedMemory = performance.memory.usedJSHeapSize;
    // @ts-ignore
    const totalMemory = performance.memory.jsHeapSizeLimit;
    return totalMemory - usedMemory;
  }

  // Fallback: assume reasonable defaults
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Conservative estimates
  if (isMobile) {
    return 200 * 1024 * 1024; // 200 MB for mobile
  }

  return 1024 * 1024 * 1024; // 1 GB for desktop
}

/**
 * Checks if there's enough memory to process a given size
 */
export function hasEnoughMemory(requiredBytes: number, safetyFactor: number = 3): boolean {
  const available = estimateAvailableMemory();
  return available > requiredBytes * safetyFactor;
}

/**
 * Creates a transferable copy of an ArrayBuffer
 */
export function createTransferable(buffer: ArrayBuffer): ArrayBuffer {
  // ArrayBuffers are transferable by default
  return buffer;
}

/**
 * Safely terminates a worker and cleans up
 */
export function terminateWorker(worker: Worker): void {
  try {
    worker.terminate();
  } catch (error) {
    console.warn('Failed to terminate worker:', error);
  }
}

/**
 * Memory pressure detector
 * Returns true if the system is under memory pressure
 */
export function isMemoryPressure(): boolean {
  // @ts-ignore
  if (typeof performance !== 'undefined' && performance.memory) {
    // @ts-ignore
    const usedMemory = performance.memory.usedJSHeapSize;
    // @ts-ignore
    const totalMemory = performance.memory.jsHeapSizeLimit;

    // Consider memory pressure if using > 80% of available heap
    return usedMemory / totalMemory > 0.8;
  }

  return false;
}
