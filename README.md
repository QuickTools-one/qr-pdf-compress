# @quicktoolsone/pdf-compress

> WebAssembly-based, fully client-side PDF compression library for modern web applications

[![npm version](https://img.shields.io/npm/v/@quicktoolsone/pdf-compress.svg)](https://www.npmjs.com/package/@quicktoolsone/pdf-compress)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Part of [QuickTools.one](https://quicktools.one)** - Privacy-focused browser-based tools for everyday file manipulation. All processing happens entirely in your browser, ensuring your files never leave your device.

## Features

- **🔒 100% Client-Side**: Zero network requests, complete privacy
- **⚡ WASM-Powered**: Fast compression using pdfcpu via WebAssembly
- **📦 Three Presets**: Lossless, Balanced, Max compression
- **🔄 Chunked Processing**: Handle large PDFs (300+ pages) reliably
- **📊 Progress Callbacks**: Real-time progress updates for UX integration
- **🛡️ Graceful Degradation**: Automatic fallback to lighter presets on errors
- **🌐 Framework Agnostic**: Works with React, Vue, Next.js, vanilla JS

## Installation

```bash
npm install @quicktoolsone/pdf-compress
```

The `pdf-lib` dependency is automatically included.

## Quick Start

```typescript
import { compress } from '@quicktoolsone/pdf-compress';

// Load PDF file
const file = await fetch('document.pdf').then(r => r.arrayBuffer());

// Compress with balanced preset (recommended)
const result = await compress(file, {
  preset: 'balanced',
  onProgress: (event) => {
    console.log(`${event.phase}: ${event.progress}%`);
  }
});

// Result contains compressed PDF and statistics
console.log(`Original: ${result.stats.originalSize} bytes`);
console.log(`Compressed: ${result.stats.compressedSize} bytes`);
console.log(`Saved: ${result.stats.percentageSaved.toFixed(1)}%`);

// Download compressed PDF
const blob = new Blob([result.pdf], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'compressed.pdf';
a.click();
```

## Compression Presets

### Lossless (5-30% reduction)
Optimizes PDF structure without quality loss. Best for documents with text and vectors.

```typescript
const result = await compress(pdfBuffer, { preset: 'lossless' });
// or
import { compressLossless } from '@quicktoolsone/pdf-compress';
const result = await compressLossless(pdfBuffer);
```

### Balanced (30-70% reduction) ⭐ Recommended
Smart image compression with minimal quality impact. Preserves text and vectors.

```typescript
const result = await compress(pdfBuffer, { preset: 'balanced' });
// or
import { compressBalanced } from '@quicktoolsone/pdf-compress';
const result = await compressBalanced(pdfBuffer);
```

### Max (60-90% reduction)
Aggressive compression with optional rasterization. May reduce image quality.

```typescript
const result = await compress(pdfBuffer, { preset: 'max' });
// or
import { compressMax } from '@quicktoolsone/pdf-compress';
const result = await compressMax(pdfBuffer);
```

## Advanced Options

```typescript
import { compress } from '@quicktoolsone/pdf-compress';

const result = await compress(pdfBuffer, {
  preset: 'balanced',

  // Pages per chunk (default: 10, auto-adjusts for mobile)
  chunkSize: 10,

  // Progress callback
  onProgress: (event) => {
    console.log(`${event.phase}: ${event.progress}%`);
    if (event.estimatedTimeRemaining) {
      console.log(`ETA: ${event.estimatedTimeRemaining}ms`);
    }
  },

  // Custom WASM URL (optional, defaults to jsdelivr CDN)
  wasmUrl: 'https://cdn.jsdelivr.net/npm/@quicktoolsone/pdf-compress@1.0.0/src/wasm/build/pdfcpu.wasm',

  // Graceful degradation (default: true)
  gracefulDegradation: true,

  // Preserve metadata (default: true for lossless/balanced, false for max)
  preserveMetadata: true,

  // Override preset DPI (balanced/max only)
  targetDPI: 150,

  // Override JPEG quality 0-1 (balanced/max only)
  jpegQuality: 0.65,

  // Merge strategy: 'worker' (default) or 'main' thread
  mergeStrategy: 'worker',

  // Timeout in milliseconds (default: 300000 = 5 minutes)
  timeout: 300000,
});
```

## Framework Examples

### React

```typescript
import { compress } from '@quicktoolsone/pdf-compress';
import { useState } from 'react';

function PDFCompressor() {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const handleCompress = async (file: File) => {
    const buffer = await file.arrayBuffer();

    const compressed = await compress(buffer, {
      preset: 'balanced',
      onProgress: (event) => setProgress(event.progress)
    });

    setResult(compressed);

    // Download
    const blob = new Blob([compressed.pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compressed.pdf';
    a.click();
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => e.target.files?.[0] && handleCompress(e.target.files[0])}
      />
      {progress > 0 && <progress value={progress} max={100} />}
      {result && <p>Saved {result.stats.percentageSaved.toFixed(1)}%</p>}
    </div>
  );
}
```

### Next.js (App Router)

```typescript
'use client'

import { compress } from '@quicktoolsone/pdf-compress';

export default function CompressPage() {
  async function handleCompress(file: File) {
    const buffer = await file.arrayBuffer();
    const result = await compress(buffer, { preset: 'balanced' });

    // Download
    const blob = new Blob([result.pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url);
  }

  return (
    <input
      type="file"
      accept="application/pdf"
      onChange={(e) => e.target.files?.[0] && handleCompress(e.target.files[0])}
    />
  );
}
```

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>PDF Compressor</title>
</head>
<body>
  <input type="file" id="pdfInput" accept="application/pdf">
  <progress id="progress" value="0" max="100"></progress>
  <div id="result"></div>

  <script type="module">
    import { compress } from '@quicktoolsone/pdf-compress';

    document.getElementById('pdfInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const buffer = await file.arrayBuffer();
      const progress = document.getElementById('progress');
      const result = await compress(buffer, {
        preset: 'balanced',
        onProgress: (event) => {
          progress.value = event.progress;
        }
      });

      document.getElementById('result').textContent =
        `Saved ${result.stats.percentageSaved.toFixed(1)}%`;

      // Download
      const blob = new Blob([result.pdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'compressed.pdf';
      a.click();
    });
  </script>
</body>
</html>
```

## How It Works

@quicktools/pdf-compress uses a chunked processing approach for reliability and memory efficiency:

1. **Validation**: Checks if input is a valid PDF
2. **Chunking**: Splits PDF into chunks (default: 10 pages)
3. **Worker Processing**: Each chunk is compressed in a separate worker
4. **Worker Restart**: Workers terminate after each chunk to free memory
5. **Merging**: Compressed chunks are merged into final PDF
6. **Graceful Degradation**: Falls back to lighter presets on errors

This architecture enables processing of 300-1000+ page PDFs even on mobile devices.

## Browser Support

- Chrome/Edge 90+
- Firefox 89+
- Safari 15+
- Mobile: iOS 15+, Android Chrome 90+

**Requirements**: WebAssembly, Web Workers, ArrayBuffer support

## Performance

### Compression Ratios (Expected)

| Preset | Expected Savings | Processing Speed |
|--------|-----------------|------------------|
| Lossless | 5-30% | ~50 pages/sec |
| Balanced | 30-70% | ~30 pages/sec |
| Max | 60-90% | ~20 pages/sec |

*Performance varies based on PDF content, device, and page complexity*

### Memory Usage

- **Desktop**: ~200MB per worker instance
- **Mobile**: ~100MB per worker instance
- **Chunk Size**: Auto-adjusts based on device and file size

## Error Handling

```typescript
import { compress, CompressionError } from '@quicktoolsone/pdf-compress';

try {
  const result = await compress(pdfBuffer, { preset: 'max' });
} catch (error) {
  if (error instanceof CompressionError) {
    console.error(`Failed: ${error.message}`);
    console.log(`Attempted preset: ${error.attemptedPreset}`);
    console.log(`Original size: ${error.originalSize}`);
  }
}
```

With graceful degradation enabled (default), compression will automatically fall back to lighter presets:

```
Max fails → Balanced → Lossless → Return original PDF
```

## Development Status

### ✅ v1.0 - MVP (Current)

- [x] Three compression presets
- [x] Chunked processing with worker restart
- [x] Progress callbacks
- [x] CDN WASM loading
- [x] Basic error handling
- [x] Graceful degradation

### 🚧 Upcoming Features

**v1.1 - Enhanced UX**
- [ ] Compression reports (detailed savings breakdown)
- [ ] Configurable chunk size via API
- [ ] Metadata preservation options
- [ ] Batch processing API

**v2.0 - Advanced Features**
- [ ] Multi-threaded compression (parallel chunks)
- [ ] Streaming PDF input/output
- [ ] Custom compression profiles
- [ ] Rasterization quality controls

## Important Notes

### WASM Module

The library automatically loads the pdfcpu WASM module from **jsdelivr CDN** when you call the compression functions. No additional setup is required - it just works!

**CDN Details:**
- Default URL: `https://cdn.jsdelivr.net/npm/@quicktoolsone/pdf-compress@latest/src/wasm/build/pdfcpu.wasm`
- WASM size: ~14 MB (served with gzip compression by jsdelivr)
- First load: Downloads from CDN and caches in browser
- Subsequent loads: Uses browser cache

**Custom CDN (optional):**
If you want to self-host the WASM files or use a different CDN:

```typescript
import { compress } from '@quicktoolsone/pdf-compress';

const result = await compress(pdfBuffer, {
  preset: 'balanced',
  wasmUrl: 'https://your-cdn.com/pdfcpu.wasm',
  wasmExecUrl: 'https://your-cdn.com/wasm_exec.js'
});
```

**Building WASM from source:**
To build the WASM module yourself:

```bash
cd wasm-build
./build.sh
```

See `wasm-build/README.md` for detailed build instructions.

### Limitations

- WASM loading requires internet connection on first use (cached afterward)
- Large files (>500 pages) may take several minutes to process
- Mobile devices have stricter memory limits
- Text becomes non-searchable if rasterization is enabled (max preset)

## License

MIT License - see [LICENSE](LICENSE) file

This software includes [pdfcpu](https://github.com/pdfcpu/pdfcpu), licensed under Apache 2.0.

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Acknowledgments

- [pdfcpu](https://github.com/pdfcpu/pdfcpu) - Excellent PDF library in Go
- [pdf-lib](https://pdf-lib.js.org/) - PDF manipulation in JavaScript
- Go team for WebAssembly support

## About QuickTools

This library powers the PDF compression tool at [QuickTools.one](https://quicktools.one), a collection of privacy-first browser tools for document and image manipulation. Try the online version with a simple drag-and-drop interface, or integrate this library into your own applications.

## Support

- 📝 [Documentation](https://github.com/your-org/qr-pdf-compress/docs)
- 🐛 [Issue Tracker](https://github.com/your-org/qr-pdf-compress/issues)
- 💬 [Discussions](https://github.com/your-org/qr-pdf-compress/discussions)
