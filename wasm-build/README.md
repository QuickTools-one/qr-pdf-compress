# pdfcpu WASM Build

This directory contains the Go source code and build scripts for compiling pdfcpu to WebAssembly.

## Prerequisites

- Go 1.21 or higher
- bash shell

## Building

To build the WASM module:

```bash
cd wasm-build
./build.sh
```

This will:
1. Compile `main.go` to WebAssembly (`pdfcpu.wasm`)
2. Copy the Go WASM runtime (`wasm_exec.js`)
3. Compress the WASM with gzip (for CDN distribution)
4. Output files to `../src/wasm/build/`

## Build Outputs

- `src/wasm/build/pdfcpu.wasm` - The compiled WASM module (~14 MB)
- `src/wasm/build/pdfcpu.wasm.gz` - Gzipped version (~3.4 MB) for CDN
- `src/wasm/build/wasm_exec.js` - Go WASM runtime support

## API

The WASM module exposes these functions to JavaScript:

### `pdfcpuCompress(data: Uint8Array, options: object): object`

Compresses a PDF with configurable options.

**Parameters:**
- `data` - PDF file as Uint8Array
- `options` - Compression options:
  - `preset` - Compression preset: "lossless", "balanced", or "max"
  - `targetDPI` - Target DPI for images (optional)
  - `jpegQuality` - JPEG quality 0-1 (optional)

**Returns:**
```javascript
{
  success: boolean,
  data?: Uint8Array,        // Compressed PDF (if successful)
  error?: string,           // Error message (if failed)
  originalSize: number,     // Original size in bytes
  compressedSize: number    // Compressed size in bytes
}
```

### `pdfcpuOptimize(data: Uint8Array): object`

Performs lossless optimization on a PDF.

**Parameters:**
- `data` - PDF file as Uint8Array

**Returns:**
```javascript
{
  success: boolean,
  data?: Uint8Array,        // Optimized PDF (if successful)
  error?: string,           // Error message (if failed)
  originalSize: number,     // Original size in bytes
  optimizedSize: number     // Optimized size in bytes
}
```

### `pdfcpuVersion(): object`

Returns the pdfcpu version.

**Returns:**
```javascript
{
  version: string  // pdfcpu version string
}
```

## Implementation Details

### Compression Strategy

The WASM implementation uses pdfcpu's optimization features:

1. **Structure optimization** - Removes redundant PDF objects
2. **Stream compression** - Compresses content streams
3. **Resource deduplication** - Removes duplicate resources
4. **Content stream optimization** - Deduplicates content across pages

**Note:** Advanced image DPI/quality control is not directly supported in pdfcpu's Go API. The library focuses on structural optimization rather than image resampling. For aggressive image compression, consider pre-processing images before PDF creation or using server-side tools.

### Memory Management

The Go WASM runtime includes garbage collection. Large PDFs may require significant memory:

- Input PDF is loaded into WASM memory
- Processing creates temporary structures
- Output PDF is allocated in WASM memory
- Peak memory usage can be 3-4x the PDF size

For very large PDFs (>50 MB), consider:
- Processing on the server instead of client
- Splitting into smaller chunks
- Using streaming APIs

## Deployment

For production use:

1. Upload `pdfcpu.wasm.gz` to your CDN
2. Upload `wasm_exec.js` to your CDN
3. Update `DEFAULT_WASM_URL` in `src/wasm/loader.ts`
4. Update `DEFAULT_WASM_EXEC_URL` in `src/wasm/loader.ts`
5. Configure CDN to serve `.wasm` files with `application/wasm` MIME type
6. Enable gzip/brotli compression on your CDN

## Development

To modify the WASM implementation:

1. Edit `main.go`
2. Run `./build.sh`
3. Test with the library examples
4. Commit both `main.go` and `go.sum`

## Troubleshooting

### Build fails with "Go is not installed"

Install Go 1.21+ from https://go.dev/dl/

### Build fails with "missing go.sum entry"

Run `go mod tidy` in this directory first.

### WASM file is too large

The WASM file is ~14 MB uncompressed, ~3.4 MB gzipped. This is expected for a full PDF processing library. To reduce size:

- Use the gzipped version (`.wasm.gz`) on your CDN
- Enable CDN compression
- Consider lazy-loading the WASM only when needed

### Runtime errors in browser

Check browser console for errors. Common issues:
- WASM file not loaded (check CDN URL)
- `wasm_exec.js` not loaded (check script URL)
- Browser doesn't support WASM (requires modern browser)
- Out of memory (reduce PDF size or use server-side processing)
