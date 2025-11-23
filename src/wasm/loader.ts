/**
 * WASM loader for lazy-loading the pdfcpu WASM module
 */

// Types for Go WASM
declare global {
  interface Window {
    Go: any;
    pdfcpuCompress?: (data: Uint8Array, options: any) => any;
    pdfcpuOptimize?: (data: Uint8Array) => any;
    pdfcpuVersion?: () => any;
  }
}

let goInstance: any = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;
let isReady = false;

/**
 * Default CDN URL for WASM module
 * In production, this should point to your CDN
 */
const DEFAULT_WASM_URL = 'https://cdn.example.com/qr-pdf-compress/v1.0.0/pdfcpu.wasm';
const DEFAULT_WASM_EXEC_URL = 'https://cdn.example.com/qr-pdf-compress/v1.0.0/wasm_exec.js';

/**
 * Loads the WASM module from the specified URL
 * Uses caching to avoid reloading
 */
export async function loadWASM(
  wasmUrl: string = DEFAULT_WASM_URL,
  wasmExecUrl: string = DEFAULT_WASM_EXEC_URL
): Promise<void> {
  // If already loaded, return immediately
  if (isReady && goInstance) {
    return;
  }

  // If currently loading, wait for existing load
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  // Start loading
  isLoading = true;
  loadPromise = (async () => {
    try {
      // Load wasm_exec.js (Go WASM support file)
      if (typeof window.Go === 'undefined') {
        await loadScript(wasmExecUrl);
      }

      // Fetch WASM binary
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM from ${wasmUrl}: ${response.status} ${response.statusText}`);
      }

      const wasmBytes = await response.arrayBuffer();

      // Initialize Go WASM
      const go = new window.Go();
      goInstance = go;

      // Instantiate WASM
      const result = await WebAssembly.instantiate(wasmBytes, go.importObject);

      // Wait for WASM to be ready
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (
            window.pdfcpuCompress &&
            window.pdfcpuOptimize &&
            window.pdfcpuVersion
          ) {
            isReady = true;
            resolve();
          } else {
            setTimeout(checkReady, 50);
          }
        };

        // Run the Go program
        go.run(result.instance).catch((err: Error) => {
          console.error('Go WASM error:', err);
        });

        checkReady();
      });

      console.log('WASM module loaded successfully');
    } catch (error) {
      goInstance = null;
      isReady = false;
      throw new Error(
        `Failed to load WASM: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Helper to load a script
 */
function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

/**
 * Gets the Go WASM instance
 * Throws if WASM is not loaded
 */
export function getWASMInstance(): any {
  if (!goInstance || !isReady) {
    throw new Error('WASM module not loaded. Call loadWASM() first.');
  }
  return goInstance;
}

/**
 * Checks if WASM is loaded
 */
export function isWASMLoaded(): boolean {
  return isReady && goInstance !== null;
}

/**
 * Unloads the WASM module (for testing/cleanup)
 */
export function unloadWASM(): void {
  goInstance = null;
  isReady = false;
  isLoading = false;
  loadPromise = null;
}
