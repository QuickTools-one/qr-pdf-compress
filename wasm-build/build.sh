#!/bin/bash

# pdfcpu WASM Build Script
# Compiles pdfcpu Go library to WebAssembly

set -e

echo "Building pdfcpu WASM module..."

# Check for Go installation
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed. Please install Go 1.21+ first."
    exit 1
fi

# Check Go version
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
MIN_VERSION="1.21"

if [ "$(printf '%s\n' "$MIN_VERSION" "$GO_VERSION" | sort -V | head -n1)" != "$MIN_VERSION" ]; then
    echo "Error: Go version $GO_VERSION is too old. Please upgrade to Go 1.21+"
    exit 1
fi

# Create output directory
mkdir -p ../src/wasm/build

# Build WASM
echo "Compiling to WASM..."
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o ../src/wasm/build/pdfcpu.wasm main.go

# Copy wasm_exec.js from Go installation
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" ../src/wasm/build/

# Get file size
WASM_SIZE=$(stat -f%z ../src/wasm/build/pdfcpu.wasm 2>/dev/null || stat -c%s ../src/wasm/build/pdfcpu.wasm)
WASM_SIZE_MB=$(echo "scale=2; $WASM_SIZE / 1024 / 1024" | bc)

echo "✅ Build complete!"
echo "📦 WASM size: ${WASM_SIZE_MB} MB"
echo "📁 Output: src/wasm/build/pdfcpu.wasm"

# Optionally compress with gzip for CDN
if command -v gzip &> /dev/null; then
    echo "Compressing with gzip..."
    gzip -9 -c ../src/wasm/build/pdfcpu.wasm > ../src/wasm/build/pdfcpu.wasm.gz
    GZ_SIZE=$(stat -f%z ../src/wasm/build/pdfcpu.wasm.gz 2>/dev/null || stat -c%s ../src/wasm/build/pdfcpu.wasm.gz)
    GZ_SIZE_MB=$(echo "scale=2; $GZ_SIZE / 1024 / 1024" | bc)
    echo "📦 Gzipped size: ${GZ_SIZE_MB} MB"
fi

echo ""
echo "Next steps:"
echo "1. Upload pdfcpu.wasm to your CDN"
echo "2. Update DEFAULT_WASM_URL in src/wasm/loader.ts"
echo "3. Build the library: npm run build"
