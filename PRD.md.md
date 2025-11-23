# QR-PDF-Compress — Client-Side PDF Compression Library (PRD v3)

## 1. Overview

QR-PDF-Compress is a WebAssembly-based, fully client-side PDF compression library designed for modern web applications. It enables meaningful PDF size reduction directly in the browser — with no server, no uploads, and full privacy.

## 2. Problem Statement

Existing PDF tools fail to provide reliable, high-quality client-side compression. Server tools require uploads; pure JS tools are weak; WASM engines are heavy. No unified solution exists.

## 3. Goals

- Real PDF compression in-browser
- WASM-based engine (pdfcpu)
- Lossless / Balanced / Max presets
- Works on all browsers + PWAs
- Framework-agnostic (Next.js, React, Vue, etc.)

## 4. Non-Goals

- Full PDF editing capabilities
- OCR functionality
- Server-side compression
- Real-time collaboration features

## 5. Target Users

Developers building privacy-first PDF tools, intranet apps, PWAs, and document management systems.

## 6. Key Features

- Three compression presets: Lossless, Balanced, Max
- Chunked processing for large files (300+ pages)
- Progress callbacks for UX integration
- Graceful degradation on errors
- Lazy WASM loading (CDN or bundled)

## 7. Architecture

### 7.1 High-Level Flow

```
User Code → Public API → Orchestrator → Compression Workers → WASM Engine
                                      ↓
                                  Merge Worker → Final PDF
```

### 7.2 Component Breakdown

- **Public API** (`src/api/`): `compress()` function, TypeScript types
- **Core Orchestrator** (`src/core/`): Chunking logic, preset mapping, error handling
- **Compression Worker** (`src/workers/compression.worker.ts`): Per-chunk WASM processing
- **Merge Worker** (`src/workers/merge.worker.ts`): pdf-lib-based chunk merging
- **WASM Loader** (`src/wasm/`): Lazy loading from CDN or bundled binary

### 7.3 Data Flow

1. Main thread receives PDF as ArrayBuffer
1. Orchestrator splits into page chunks (default: 10 pages)
1. For each chunk:
- Spawn fresh Compression Worker
- Worker loads pdfcpu WASM (cached after first load)
- Worker extracts pages using pdf-lib
- Worker compresses via pdfcpu WASM
- Worker returns compressed mini-PDF as ArrayBuffer (transferable)
- Worker terminates
1. All chunks sent to Merge Worker
1. Merge Worker combines chunks using pdf-lib
1. Final compressed PDF returned to user

## 8. Technical Considerations

### 8.1 WASM Engine Selection: **pdfcpu**

**Why pdfcpu:**

- Native Go implementation with proven compression algorithms
- Supports all three preset requirements (optimize, downsample, linearize)
- Active maintenance and community support
- Can be compiled to WASM with TinyGo or standard Go 1.21+ WASM target

**Compilation Requirements:**

- Go 1.21+ with WASM support
- Build flags: `GOOS=js GOARCH=wasm`
- Optimize for size: `-ldflags="-s -w"`
- Expected WASM size: 2-3MB gzipped

**Build Command:**

```bash
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o pdfcpu.wasm
```

### 8.2 WASM Loading Strategy

**Default: CDN-hosted (lazy load)**

```typescript
// WASM loaded only when compress() is first called
const wasmUrl = 'https://cdn.yourdomain.com/pdfcpu-v1.0.0.wasm';
```

**Alternative: Bundled (offline/intranet)**

```typescript
import wasmUrl from './wasm/pdfcpu.wasm?url'; // Vite asset handling
```

**Loading Logic:**

- First `compress()` call triggers WASM fetch
- Subsequent calls use cached instance
- Workers share WASM module via SharedArrayBuffer (if available) or re-fetch

### 8.3 Dependencies

**Required:**

- **pdf-lib** (^1.17.1): Page extraction and merging
- **pdfcpu WASM**: Compression engine (compiled separately)

**Dev Dependencies:**

- **Vite**: Build tool with WASM support
- **TypeScript**: Type safety
- **Vitest**: Unit testing
- **@types/node**: Node type definitions

### 8.4 Memory Handling

- **Chunk size**: 10 pages (configurable via API)
- **Worker lifecycle**: Spawn → Process → Terminate (per chunk)
- **Transferable objects**: Use ArrayBuffer transfers (zero-copy)
- **Mobile constraints**: Tested on iOS Safari (600MB heap limit)

### 8.5 Browser Compatibility

- Chrome/Edge 90+
- Firefox 89+
- Safari 15+
- Mobile: iOS 15+, Android Chrome 90+
- **Requirements**: WebAssembly, Web Workers, ArrayBuffer

## 9. UX Considerations

### 9.1 Progress Callbacks

```typescript
onProgress: (event: ProgressEvent) => void

interface ProgressEvent {
  phase: 'chunking' | 'compressing' | 'merging';
  progress: number; // 0-100
  currentChunk?: number;
  totalChunks?: number;
  estimatedTimeRemaining?: number; // milliseconds
}
```

### 9.2 Preset Descriptions

User-facing explanations for each preset:

- **Lossless**: “Optimize structure without quality loss. Best for documents with text and vectors.”
- **Balanced**: “Smart compression with minimal quality impact. Recommended for most PDFs.”
- **Max**: “Maximum compression. May reduce image quality. Best for scanned documents.”

### 9.3 Warnings and Error Messages

- Large file warning: “File > 50MB may take several minutes”
- Mobile warning: “Large PDFs may fail on low-memory devices”
- Graceful degradation: “Max compression failed, trying Balanced…”

## 10. Security & Privacy

### 10.1 Privacy Guarantees

- **Zero network requests** (except initial WASM download from CDN)
- **No telemetry or analytics**
- **Memory cleared** after processing (explicit ArrayBuffer cleanup)
- **No persistent storage** (unless user opts in)

### 10.2 Security Measures

- **Content Security Policy** compatible (workers from blob URLs)
- **CORS-safe** WASM loading
- **Input validation**: Verify PDF magic bytes before processing
- **Sandboxed workers**: No access to main thread DOM

## 11. Success Metrics

### 11.1 Performance Targets

- **Compression ratio**: Match expectations per preset (see section 18)
- **Processing speed**: < 2 seconds per 10-page chunk (modern desktop)
- **WASM bundle size**: < 3MB gzipped
- **Memory usage**: < 200MB per worker instance

### 11.2 Reliability Targets

- **Success rate**: > 95% for standard PDFs
- **Graceful degradation**: 100% (always return original or best-effort result)
- **Mobile stability**: No crashes on iOS Safari with < 100-page PDFs

## 12. Roadmap

### v1.0 — Core Functionality (MVP)

- [x] Three compression presets
- [x] Chunked processing with worker restart
- [x] Progress callbacks
- [x] CDN WASM loading
- [x] Basic error handling

### v1.1 — Enhanced UX

- [ ] Compression reports (savings breakdown)
- [ ] Configurable chunk size
- [ ] Metadata preservation options
- [ ] Batch processing API

### v2.0 — Advanced Features

- [ ] Multi-threaded compression (parallel chunks)
- [ ] Streaming PDF input/output
- [ ] Custom compression profiles
- [ ] Rasterization quality controls

### v2.1 — Developer Experience

- [ ] CLI tool for testing
- [ ] Compression simulator (estimate savings without processing)
- [ ] Debug mode with detailed logs

## 13. File Structure

```
qr-pdf-compress/
├── src/
│   ├── api/
│   │   ├── index.ts              # Public API exports
│   │   ├── compress.ts           # Main compress() function
│   │   └── types.ts              # TypeScript interfaces
│   ├── core/
│   │   ├── orchestrator.ts       # Chunking and worker management
│   │   ├── presets.ts            # Preset configurations
│   │   ├── error-handler.ts      # Graceful degradation logic
│   │   └── progress.ts           # Progress event aggregation
│   ├── workers/
│   │   ├── compression.worker.ts # Per-chunk compression
│   │   ├── merge.worker.ts       # Final PDF merging
│   │   └── wasm-bridge.ts        # WASM <-> JS interface
│   ├── wasm/
│   │   ├── loader.ts             # Lazy WASM loading logic
│   │   ├── pdfcpu-adapter.ts     # pdfcpu command mapping
│   │   └── build/                # Compiled WASM binaries
│   └── utils/
│       ├── pdf-utils.ts          # PDF validation, page counting
│       └── memory.ts             # Memory cleanup helpers
├── dist/                          # Built package (ESM + CJS)
│   ├── index.js
│   ├── index.d.ts
│   └── workers/                   # Bundled worker scripts
├── examples/
│   ├── nextjs-app-router/        # Next.js 13+ example
│   ├── nextjs-pages-router/      # Next.js Pages Router example
│   └── vanilla/                   # Plain HTML + JS example
├── wasm-build/
│   ├── build.sh                   # pdfcpu WASM compilation script
│   ├── go.mod
│   └── main.go                    # Go entrypoint for WASM
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/                  # Test PDF files
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## 14. Licensing

### 14.1 Library License

**MIT License** for the JavaScript/TypeScript wrapper code.

### 14.2 pdfcpu License

pdfcpu is **Apache 2.0** licensed, compatible with MIT for distribution.

### 14.3 Dependency Licenses

- **pdf-lib**: MIT
- **Go WASM runtime**: BSD-3-Clause

**Distribution Requirements:**

- Include Apache 2.0 license text for pdfcpu
- Include Go WASM runtime license in bundled builds

## 15. Risks & Mitigations

### 15.1 Large File Handling

**Risk:** Files > 500 pages may exceed mobile browser memory limits.
**Mitigation:**

- Configurable chunk size (reduce to 5 pages for large files)
- Automatic detection and chunk size adjustment
- Clear warnings in documentation

### 15.2 WASM Compilation Complexity

**Risk:** pdfcpu WASM compilation may fail or produce large binaries.
**Mitigation:**

- Provide pre-compiled WASM binaries in releases
- Document build process with Docker-based build environment
- Fallback to pdf-lib-only mode (limited compression)

### 15.3 Mobile RAM Constraints

**Risk:** iOS Safari kills workers on high memory pressure.
**Mitigation:**

- Small chunk sizes (10 pages default, 5 for mobile)
- Aggressive memory cleanup after each chunk
- Feature detection to warn users on low-memory devices

### 15.4 WASM Bundle Size

**Risk:** 2-3MB WASM may slow initial load on slow networks.
**Mitigation:**

- Lazy loading (only when compress() is called)
- CDN hosting with HTTP/2 and Brotli compression
- Optional: Split WASM by preset (load only needed compression logic)

## 16. API Design

### 16.1 Core API

```typescript
import { compress, CompressionPreset, ProgressEvent } from 'qr-pdf-compress';

const compressedPdf = await compress(pdfArrayBuffer, {
  preset: 'balanced',           // 'lossless' | 'balanced' | 'max'
  chunkSize: 10,                // Pages per chunk (default: 10)
  onProgress: (event) => {      // Optional progress callback
    console.log(`${event.phase}: ${event.progress}%`);
  },
  wasmUrl: 'https://custom-cdn.com/pdfcpu.wasm', // Optional custom WASM URL
  gracefulDegradation: true,    // Fallback to lighter preset on error (default: true)
});

// Result: ArrayBuffer of compressed PDF
```

### 16.2 Advanced Options (v1.1+)

```typescript
interface CompressionOptions {
  preset: CompressionPreset;
  chunkSize?: number;
  onProgress?: (event: ProgressEvent) => void;
  wasmUrl?: string;
  gracefulDegradation?: boolean;
  
  // v1.1+
  preserveMetadata?: boolean;   // Keep XMP, document info (default: false for Max)
  targetDPI?: number;            // Override preset DPI (Balanced/Max only)
  jpegQuality?: number;          // Override JPEG quality (0-1, Balanced/Max only)
  enableRasterization?: boolean; // Force rasterization in Max mode (default: auto)
  mergeStrategy?: 'worker' | 'main'; // Default: 'worker'
}
```

### 16.3 Error Handling

```typescript
try {
  const result = await compress(pdf, { preset: 'max' });
} catch (error) {
  if (error instanceof CompressionError) {
    console.error(`Failed: ${error.message}`);
    console.log(`Attempted preset: ${error.attemptedPreset}`);
    console.log(`Original size: ${error.originalSize}`);
  }
}
```

### 16.4 Framework Integration Examples

**Next.js App Router (Server Action):**

```typescript
'use server'
import { compress } from 'qr-pdf-compress';

export async function compressPdf(formData: FormData) {
  const file = formData.get('pdf') as File;
  const buffer = await file.arrayBuffer();
  const compressed = await compress(buffer, { preset: 'balanced' });
  return Buffer.from(compressed);
}
```

**React Client Component:**

```typescript
'use client'
import { compress } from 'qr-pdf-compress';

function PdfCompressor() {
  const [progress, setProgress] = useState(0);
  
  const handleCompress = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const result = await compress(buffer, {
      preset: 'balanced',
      onProgress: (e) => setProgress(e.progress)
    });
    // Download or display compressed PDF
  };
}
```

## 17. Memory Management Strategy

Processing large PDFs in the browser is constrained by WASM heap limits, mobile-browser RAM caps, and the inability of WebAssembly to shrink its linear memory. To ensure reliable compression even for very large documents, the library uses a **chunked, worker-restart-based architecture**.

### 17.1 Chunked Page Processing

The engine processes pages in chunks (default: **10 pages per chunk**):

1. Main thread loads original PDF once.
1. For each 10-page chunk:
- Spawn a **fresh compression worker**.
- Worker extracts only those pages (via pdf-lib).
- Worker compresses those pages via pdfcpu WASM.
- Worker returns a **standalone mini-PDF** as an ArrayBuffer (transferable).
- Worker is **terminated** to free WASM memory.
1. Continue until all pages are processed.

### 17.2 Why Chunking Works

- Only 10 pages ever live in RAM inside a worker.
- Prevents WASM heap growth and fragmentation.
- Avoids Safari/iOS memory kills.
- Enables processing of 300–1000+ page scanned PDFs.

### 17.3 Worker Restart Strategy

WASM memory cannot shrink, so each worker instance:

- Loads WASM engine fresh (or reuses cached module)
- Processes its assigned chunk
- Returns output
- Terminates (releases all memory)

This ensures deterministic memory behavior.

### 17.4 Merging the Compressed Chunks

**Primary Strategy — Dedicated Merge Worker (Recommended)**

- Receives all chunk PDFs as ArrayBuffers.
- Uses pdf-lib to merge sequentially.
- Emits progress events (e.g., “Merging 5/20”).
- Returns final merged PDF as ArrayBuffer.
- Terminates after completion.

**Fallback — Main Thread Merge**
Used when:

- Workers are blocked by CSP
- User explicitly disables workers
- Running in Node.js environment

**Implementation:**

```typescript
// Merge Worker receives:
{
  type: 'merge',
  chunks: ArrayBuffer[], // All compressed mini-PDFs
  originalMetadata: object // Preserved from original PDF
}

// Merge Worker returns:
{
  type: 'complete',
  pdf: ArrayBuffer,
  stats: { originalSize, compressedSize, ratio }
}
```

### 17.5 Benefits

- Highly stable on mobile browsers.
- Scales for massive PDFs (tested up to 1000 pages).
- Memory usage predictable and bounded.
- Compatible with all 3 presets.

### 17.6 Remaining Constraints

Chunking improves stability but does not remove:

- Need to hold final merged PDF in memory (user must download/save promptly).
- Heavy CPU cost for merging (mitigated by worker).
- Text/annotation loss if rasterization is enabled (Max preset with rasterization).

### 17.7 Memory Cleanup

After compression completes:

```typescript
// Explicit cleanup
chunks.forEach(chunk => {
  chunk = null; // Dereference for GC
});
worker.terminate(); // Force worker destruction
```

## 18. Compression Preset Specifications

### 18.1 LOSSLESS — Structural Optimization Only

**Goal:** Reduce size without altering visible content.

#### Images

- No downsampling.
- No re-encoding (JPEG/PNG kept as-is).
- Optional: lossless Flate recompression of streams.

#### Fonts

- Optional safe font subsetting (only if pdfcpu guarantees 100% safety).
- Do not modify embedded or core fonts unless fully safe.

#### Structure & Objects

- Object stream recompression (optimal Flate params).
- Object deduplication for identical images/XObjects/fonts.
- Removal of unreachable/unused objects.
- Metadata cleanup (XMP, thumbnails, redundant document info).
- Optional PDF linearization (for web viewing).

#### pdfcpu Command Mapping

```bash
pdfcpu optimize -stats=false input.pdf output.pdf
```

**Expected savings:** 5–30%

-----

### 18.2 BALANCED — Smart Image Compression, Preserve Vectors

**Goal:** Default mode. Strong compression while keeping text/vector fidelity.

#### Images

- Downsample embedded images when effective DPI > **240–300 DPI**.
- Target DPI: **150–180 DPI**.
- Re-encode images:
  - JPEG quality **0.55–0.70** (pdfcpu: `-q 60-70`).
  - Photos: Q ≈ **0.60**
  - Screenshots/flat graphics: Q ≈ **0.65–0.75**
- If recompression saves < 5%, keep original.

#### Fonts & Text

- Never rasterize text.
- Keep all vectors intact.
- Optional safe font subsetting.
- Maintain searchability/selectability.

#### Structure & Objects

- All Lossless optimizations.
- Aggressive deduplication.
- Remove alternate renditions, previews, unused name trees.

#### pdfcpu Command Mapping

```bash
pdfcpu optimize -dpi 150 -q 65 -stats=false input.pdf output.pdf
```

**Expected savings:** 30–70%

-----

### 18.3 MAX — Aggressive Compression + Optional Rasterization

**Goal:** Smallest possible file. Acceptable to trade fidelity.

#### Images (non-raster mode)

- Downsample high-DPI images to **100–144 DPI**.
- JPEG quality:
  - Photos: Q ≈ **0.35–0.45** (pdfcpu: `-q 40`)
  - Flat graphics: Q ≈ **0.45–0.55** (pdfcpu: `-q 50`)
- Optional grayscale conversion for scanned documents.

#### Full-Page Rasterization Mode (“Nuclear Mode”)

Triggered when:

- Document is scan-only (no text layers detected), OR
- User selects maximum shrink with explicit rasterization flag, OR
- pdfcpu detects exclusively image-based pages.

**Rasterization Steps:**

1. Render pages to bitmap using Canvas API or pdf.js at **110–144 DPI**.
1. Encode each page:
- JPEG/WebP Q ≈ **0.35–0.45**
1. Rebuild PDF with minimal metadata using pdf-lib.

**Trade-offs:**

- Text becomes images (not searchable/selectable).
- Links, forms, annotations removed.
- File size drastically reduced (60-90%).

#### Structure

- Same as Balanced + Lossless.
- Clean minimal structure for rasterized rebuilds.

#### pdfcpu Command Mapping (non-raster)

```bash
pdfcpu optimize -dpi 120 -q 40 -stats=false input.pdf output.pdf
```

#### Rasterization Implementation (WASM + Canvas)

```typescript
// Pseudo-code for rasterization worker
async function rasterizePage(pdfPage, dpi) {
  const viewport = pdfPage.getViewport({ scale: dpi / 72 });
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.4 });
  return await blob.arrayBuffer();
}
```

**Expected savings:** 60–90% (depending on rasterization)

-----

## 19. Graceful Degradation Strategy

When compression fails at a given preset, the library automatically tries lighter presets:

### 19.1 Degradation Flow

```
Max fails → Balanced → Lossless → Return original PDF
```

### 19.2 Failure Scenarios

- **WASM crash**: Out of memory, corrupt PDF, unsupported features
- **Timeout**: Processing exceeds 5 minutes (configurable)
- **Invalid output**: Compressed PDF fails validation

### 19.3 User Feedback

```typescript
onProgress({
  phase: 'error-recovery',
  progress: 50,
  message: 'Max compression failed (out of memory). Trying Balanced preset...'
})
```

### 19.4 Implementation

```typescript
async function compressWithFallback(pdf, preset) {
  const presets = ['max', 'balanced', 'lossless'];
  const startIndex = presets.indexOf(preset);
  
  for (let i = startIndex; i < presets.length; i++) {
    try {
      return await compressWithPreset(pdf, presets[i]);
    } catch (error) {
      if (i === presets.length - 1) {
        // All presets failed, return original
        return { pdf: originalPdf, warning: 'Compression failed, returning original' };
      }
      // Try next lighter preset
      continue;
    }
  }
}
```

-----

## 20. Build & Deployment

### 20.1 Package Build Process

```bash
# Install dependencies
npm install

# Build TypeScript + bundle workers
npm run build

# Output:
# dist/
#   ├── index.js          # ESM entry
#   ├── index.cjs         # CommonJS entry
#   ├── index.d.ts        # TypeScript types
#   └── workers/
#       ├── compression.worker.js
#       └── merge.worker.js
```

### 20.2 WASM Build Process

```bash
# Navigate to WASM build directory
cd wasm-build

# Compile pdfcpu to WASM
./build.sh

# Output: pdfcpu.wasm (2-3MB, gzip to ~800KB)

# Upload to CDN
aws s3 cp pdfcpu.wasm s3://your-cdn/qr-pdf-compress/v1.0.0/pdfcpu.wasm \
  --content-type application/wasm \
  --content-encoding gzip \
  --cache-control "public, max-age=31536000, immutable"
```

### 20.3 NPM Package Configuration

```json
{
  "name": "qr-pdf-compress",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./workers/*": "./dist/workers/*"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "peerDependencies": {
    "pdf-lib": "^1.17.1"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### 20.4 CDN Versioning Strategy

```
https://cdn.yourdomain.com/qr-pdf-compress/
  ├── v1.0.0/
  │   └── pdfcpu.wasm
  ├── v1.1.0/
  │   └── pdfcpu.wasm
  └── latest/
      └── pdfcpu.wasm  (symlink to latest stable)
```

Users can pin to specific versions or use `latest` for auto-updates.

-----

## 21. Testing Strategy

### 21.1 Unit Tests

- Preset configuration parsing
- Chunk size calculation
- Progress event aggregation
- Error handling and fallback logic

### 21.2 Integration Tests

- End-to-end compression with real PDFs
- Worker lifecycle (spawn, process, terminate)
- WASM loading from CDN and bundled
- Memory leak detection

### 21.3 Test Fixtures

```
tests/fixtures/
  ├── small-text.pdf        (5 pages, text only)
  ├── large-images.pdf      (50 pages, high-res scans)
  ├── mixed-content.pdf     (100 pages, text + images)
  └── corrupt.pdf           (intentionally malformed)
```

### 21.4 Performance Benchmarks

- Compression speed (pages/second)
- Memory usage per chunk
- WASM load time (cold vs. cached)
- Compression ratio by preset

-----

## 22. Documentation Requirements

### 22.1 README.md

- Quick start guide
- Installation instructions
- Basic usage examples
- Framework integration guides (Next.js, React, Vue)
- API reference link

### 22.2 API Documentation (docs/)

- Full TypeScript API reference
- Preset comparison table
- Advanced configuration options
- Troubleshooting guide

### 22.3 WASM Build Guide (wasm-build/README.md)

- Go environment setup
- Compilation instructions
- Docker-based build for reproducibility
- Troubleshooting common build errors

### 22.4 Contributing Guide

- Code style and linting rules
- Testing requirements
- PR process
- Release workflow

-----

## 23. Release Checklist

### v1.0.0 Release

- [ ] Core compression working for all 3 presets
- [ ] Chunked processing stable on mobile
- [ ] WASM CDN hosted and accessible
- [ ] NPM package published
- [ ] Documentation complete
- [ ] Next.js examples working (App Router + Pages Router)
- [ ] Integration tests passing
- [ ] Performance benchmarks documented
- [ ] MIT license file included
- [ ] Dependency licenses bundled

### Post-Release

- [ ] Announce on Twitter, Reddit (r/webdev, r/javascript)
- [ ] Create Product Hunt launch
- [ ] Write blog post with benchmarks
- [ ] Submit to Awesome Lists (awesome-javascript, awesome-wasm)
- [ ] Monitor GitHub issues for bug reports

-----

## 24. Future Considerations (Beyond v2.0)

### 24.1 Advanced Compression Techniques

- Machine learning-based image downsampling (preserve important details)
- Perceptual JPEG encoding (optimize for human vision)
- Font glyph optimization (custom subsetting algorithms)

### 24.2 Streaming Architecture

- Process PDFs larger than available RAM
- Incremental compression with immediate partial output
- Support for 10,000+ page documents

### 24.3 Distributed Processing

- WebRTC-based peer-to-peer compression (split work across devices)
- Service Worker background processing
- IndexedDB caching for repeated compressions

### 24.4 Format Support

- Support for PDF/A (archival PDFs)
- PDF/X (print-ready PDFs with color management)
- Hybrid compression (PDF + WebP images)

-----

## 25. Appendix

### 25.1 Glossary

- **WASM**: WebAssembly, a binary instruction format for browsers
- **Worker**: Web Worker, a browser API for background threads
- **Transferable**: ArrayBuffer that can be moved between threads without copying
- **Chunking**: Splitting a large PDF into smaller page ranges for processing
- **Graceful Degradation**: Falling back to simpler presets on error

### 25.2 References

- pdfcpu GitHub: https://github.com/pdfcpu/pdfcpu
- pdf-lib Documentation: https://pdf-lib.js.org/
- Go WASM Documentation: https://github.com/golang/go/wiki/WebAssembly
- MDN Web Workers Guide: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

### 25.3 Acknowledgments

- pdfcpu team for the excellent PDF library
- pdf-lib maintainers for merging support
- Go team for WASM target support

-----

**Document Version:** 3.0  
**Last Updated:** 2024-11-23  
**Status:** Ready for Implementation