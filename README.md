# @quicktoolsone/pdf-compress

> Battle-tested PDF compression library with multi-strategy approach

[![npm version](https://img.shields.io/npm/v/@quicktoolsone/pdf-compress.svg)](https://www.npmjs.com/package/@quicktoolsone/pdf-compress)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Part of [QuickTools.one](https://quicktools.one)** - Privacy-focused browser-based tools. All processing happens entirely in your browser.

## Features

- **🎯 Multi-Strategy Compression**: Automatically chooses the best approach for your PDF
- **🔒 100% Client-Side**: Zero network requests, complete privacy
- **📦 Three Presets**: Lossless, Balanced, Max compression
- **📊 Real-time Progress**: Detailed progress updates with page-by-page tracking
- **💪 Handles Large Files**: Memory-safe processing of 50MB+ PDFs
- **🌐 Framework Agnostic**: Works with React, Vue, Next.js, vanilla JS
- **✅ Production Ready**: Powers compression on QuickTools.one

## Installation

```bash
npm install @quicktoolsone/pdf-compress
```

**Dependencies**: `pdf-lib` (PDF manipulation) + `pdfjs-dist` (page rendering)

## Quick Start

```typescript
import { compress } from '@quicktoolsone/pdf-compress';

// Load your PDF
const file = await fetch('document.pdf').then(r => r.arrayBuffer());

// Compress with progress tracking
const result = await compress(file, {
  preset: 'balanced', // 'lossless' | 'balanced' | 'max'
  onProgress: (event) => {
    console.log(`${event.phase}: ${event.progress}%`);
    if (event.message) {
      console.log(event.message); // e.g., "Compressing page 5/98..."
    }
  }
});

// Check results
console.log(`Original: ${(result.stats.originalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Compressed: ${(result.stats.compressedSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Saved: ${result.stats.percentageSaved.toFixed(1)}%`);

// Download
const blob = new Blob([result.pdf], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'compressed.pdf';
a.click();
```

## Compression Presets

### Lossless
Structural optimization only - no quality loss. Best for text-heavy documents.

```typescript
import { compressLossless } from '@quicktoolsone/pdf-compress';
const result = await compressLossless(pdfBuffer);
```

**Expected savings**: 5-15% for most PDFs

### Balanced ⭐ Recommended
Smart multi-strategy approach that tries lossless first, then image compression if needed.

```typescript
import { compressBalanced } from '@quicktoolsone/pdf-compress';
const result = await compressBalanced(pdfBuffer);
```

**Expected savings**: 30-70% for image-heavy PDFs, 10-30% for text PDFs

### Max
Aggressive compression with lower DPI and quality. Maximum file size reduction.

```typescript
import { compressMax } from '@quicktoolsone/pdf-compress';
const result = await compressMax(pdfBuffer);
```

**Expected savings**: 60-90% for image-heavy PDFs

## How It Works

The library uses a proven multi-strategy approach battle-tested on QuickTools.one:

### Strategy 1: Lossless Optimization (Fast)
First attempt - uses `pdf-lib` for structural compression:
- Compresses internal PDF objects with object streams
- Removes redundant data
- Optimizes encoding

**For lossless preset**: Returns this result
**For balanced/max presets**: Continues to Strategy 2 for better compression

### Strategy 2: Image Compression (Powerful)
For image-heavy PDFs, renders and re-compresses images:

1. **Renders** each page with `pdf.js` at optimized DPI
2. **Adapts DPI** based on file size:
   - 50MB+: 50 DPI (extremely aggressive)
   - 20-50MB: 75 DPI
   - 10-20MB: 100 DPI
   - <10MB: 150 DPI
3. **Compresses** to JPEG with quality settings per preset:
   - Lossless: N/A (skips this strategy)
   - Balanced: 70% quality
   - Max: 50% quality
4. **Rebuilds** PDF with compressed images
5. **Memory-safe**: Cleanup between pages, extra delays for large files

### Strategy 3: Choose Best Result
Compares lossless vs image compression vs original and returns the smallest.

## API Reference

### `compress(pdfBuffer, options)`

Main compression function with full control.

```typescript
interface CompressionOptions {
  preset: 'lossless' | 'balanced' | 'max';
  onProgress?: (event: ProgressEvent) => void;
  preserveMetadata?: boolean;
  // ... other options (see types)
}

interface CompressionResult {
  pdf: ArrayBuffer;
  stats: {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    bytesSaved: number;
    percentageSaved: number;
    presetUsed: string;
    processingTime: number;
    chunksProcessed: number;
  };
}
```

**Parameters:**
- `pdfBuffer` (ArrayBuffer): PDF file to compress
- `options` (CompressionOptions): Compression settings

**Returns:** Promise<CompressionResult>

### Convenience Functions

```typescript
// Lossless compression
compressLossless(pdfBuffer, options?)

// Balanced compression (recommended)
compressBalanced(pdfBuffer, options?)

// Maximum compression
compressMax(pdfBuffer, options?)
```

### Progress Events

The `onProgress` callback receives detailed progress updates:

```typescript
interface ProgressEvent {
  phase: 'chunking' | 'compressing' | 'merging' | 'error-recovery';
  progress: number; // 0-100
  message?: string; // e.g., "Compressing page 5/98..."
  currentChunk?: number;
  totalChunks?: number;
  estimatedTimeRemaining?: number;
}
```

## Framework Examples

### React

```typescript
import { compress } from '@quicktoolsone/pdf-compress';
import { useState } from 'react';

function PDFCompressor() {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const handleCompress = async (file: File) => {
    const buffer = await file.arrayBuffer();

    const compressed = await compress(buffer, {
      preset: 'balanced',
      onProgress: (event) => {
        setProgress(event.progress);
        setMessage(event.message || '');
      }
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
      {progress > 0 && (
        <>
          <progress value={progress} max={100} />
          <p>{message}</p>
        </>
      )}
      {result && (
        <p>Saved {result.stats.percentageSaved.toFixed(1)}%
           ({(result.stats.bytesSaved / 1024 / 1024).toFixed(2)} MB)</p>
      )}
    </div>
  );
}
```

### Next.js (App Router)

```typescript
'use client'

import { compress } from '@quicktoolsone/pdf-compress';
import { useState } from 'react';

export default function CompressPage() {
  const [status, setStatus] = useState('');

  async function handleCompress(file: File) {
    const buffer = await file.arrayBuffer();

    const result = await compress(buffer, {
      preset: 'balanced',
      onProgress: (event) => {
        setStatus(`${event.progress}%: ${event.message || ''}`);
      }
    });

    // Download
    const blob = new Blob([result.pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url);
  }

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => e.target.files?.[0] && handleCompress(e.target.files[0])}
      />
      <p>{status}</p>
    </div>
  );
}
```

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<body>
  <input type="file" id="pdf" accept="application/pdf">
  <progress id="progress" value="0" max="100"></progress>
  <div id="status"></div>
  <div id="result"></div>

  <script type="module">
    import { compress } from '@quicktoolsone/pdf-compress';

    document.getElementById('pdf').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const buffer = await file.arrayBuffer();

      const result = await compress(buffer, {
        preset: 'balanced',
        onProgress: (event) => {
          document.getElementById('progress').value = event.progress;
          document.getElementById('status').textContent = event.message || '';
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

## Setup Requirements

### PDF.js Worker File

For image compression to work, you need the pdf.js worker file accessible:

**Option 1: Copy to public folder** (recommended for apps)
```bash
# After npm install
cp node_modules/pdfjs-dist/build/pdf.worker.mjs public/pdf.js/pdf.worker.min.mjs
```

**Option 2: Use CDN** (automatic fallback)
The library automatically falls back to CDN if local worker is not found.

### Vite Configuration

If using Vite, add to `vite.config.ts`:

```typescript
export default defineConfig({
  publicDir: 'public', // Ensure public folder is served
});
```

### Next.js Configuration

Copy worker to `public` folder:
```bash
mkdir -p public/pdf.js
cp node_modules/pdfjs-dist/build/pdf.worker.mjs public/pdf.js/pdf.worker.min.mjs
```

## Browser Support

- Chrome/Edge 90+
- Firefox 89+
- Safari 15+
- Mobile: iOS 15+, Android Chrome 90+

**Requirements:**
- Browser environment (uses Canvas API)
- JavaScript enabled
- Modern ES2020+ support

## Expected Compression Results

Results vary based on PDF content:

| PDF Type | Lossless | Balanced | Max |
|----------|----------|----------|-----|
| Text-heavy PDFs | 10-30% | 15-40% | 20-50% |
| Mixed content | 10-25% | 30-60% | 50-80% |
| Image-heavy PDFs | 5-15% | 40-70% | 60-90% |
| Scanned documents | 5-10% | 50-80% | 70-95% |
| Already optimized | 2-10% | 5-20% | 10-30% |

**Real example**: 41MB scanned workbook (98 pages) → 2.6MB with balanced preset (94% reduction)

## Performance Considerations

### Processing Time

- **Lossless**: Very fast (~1-2 seconds for most PDFs)
- **Balanced**: Moderate (depends on page count and size)
  - Small (<10MB): 5-15 seconds
  - Medium (10-20MB): 15-45 seconds
  - Large (20-50MB): 45-90 seconds
  - Very large (50MB+): 2-5 minutes
- **Max**: Similar to balanced (aggressive DPI helps with large files)

### Memory Usage

The library is designed to handle large files safely:
- Garbage collection between pages
- Extra delays for very large files (50MB+)
- Adaptive DPI based on file size
- Canvas cleanup after each page

**Typical memory usage**: 100-300MB peak during processing

## Error Handling

```typescript
import { compress, CompressionError } from '@quicktoolsone/pdf-compress';

try {
  const result = await compress(pdfBuffer, { preset: 'balanced' });
} catch (error) {
  if (error instanceof CompressionError) {
    console.error('Compression failed:', error.message);
    console.log('Attempted preset:', error.attemptedPreset);
    console.log('Original size:', error.originalSize);
    console.log('Phase:', error.phase);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Common Issues

### "Failed to load PDF.js worker"
- Ensure `pdf.worker.min.mjs` is in `public/pdf.js/` folder
- Or let it fall back to CDN (automatic)

### "Out of memory" errors
- Try a lighter preset (balanced instead of max)
- Process smaller PDFs
- Close other browser tabs to free memory

### Compression doesn't reduce size much
- PDF may already be optimized
- Text-heavy PDFs compress less than image-heavy ones
- Try different presets to see which works best

## TypeScript Support

Full TypeScript support with detailed type definitions:

```typescript
import {
  compress,
  type CompressionOptions,
  type CompressionResult,
  type ProgressEvent,
  CompressionError
} from '@quicktoolsone/pdf-compress';
```

## License

MIT License - see [LICENSE](LICENSE) file

## About QuickTools

This library powers the PDF compression tool at [QuickTools.one](https://quicktools.one), a collection of privacy-first browser tools for document manipulation. The compression algorithm has been tested on thousands of PDFs in production.

## Support & Contributing

- 🐛 [Issue Tracker](https://github.com/quicktools-one/pdf-compress/issues)
- 💬 [Discussions](https://github.com/quicktools-one/pdf-compress/discussions)
- 📖 [Changelog](https://github.com/quicktools-one/pdf-compress/releases)

## Credits

Built with:
- [pdf-lib](https://pdf-lib.js.org/) - PDF manipulation
- [pdf.js](https://mozilla.github.io/pdf.js/) - Page rendering
- Tested and refined on [QuickTools.one](https://quicktools.one)
