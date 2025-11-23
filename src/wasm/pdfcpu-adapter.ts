import type { CompressionPreset } from '../api/types';
import { getWASMInstance } from './loader';

/**
 * Adapter for pdfcpu WASM compression
 */

export interface CompressionParams {
  preset: CompressionPreset;
  targetDPI?: number;
  jpegQuality?: number;
  preserveMetadata?: boolean;
  enableRasterization?: boolean;
}

/**
 * Compresses a PDF using pdfcpu WASM
 */
export async function compressPDFWithWASM(
  pdfBuffer: ArrayBuffer,
  params: CompressionParams
): Promise<ArrayBuffer> {
  const startTime = Date.now();

  // Ensure WASM is loaded
  if (!window.pdfcpuCompress) {
    throw new Error('WASM not loaded. Call loadWASM() first.');
  }

  // Validate PDF buffer
  if (!validatePDFBuffer(pdfBuffer)) {
    throw new Error('Invalid PDF buffer');
  }

  // Convert ArrayBuffer to Uint8Array
  const pdfData = new Uint8Array(pdfBuffer);

  // Prepare options for WASM call
  const options = {
    preset: params.preset,
    targetDPI: params.targetDPI,
    jpegQuality: params.jpegQuality,
  };

  // Call WASM compression function
  const result = window.pdfcpuCompress(pdfData, options);

  // Check for errors
  if (!result.success) {
    throw new Error(result.error || 'Compression failed');
  }

  const compressedData = result.data;
  const compressedBuffer = compressedData.buffer.slice(
    compressedData.byteOffset,
    compressedData.byteOffset + compressedData.byteLength
  );

  console.log(`Compressed PDF with ${params.preset} preset in ${Date.now() - startTime}ms`);
  console.log(`Original size: ${pdfBuffer.byteLength} bytes`);
  console.log(`Compressed size: ${compressedBuffer.byteLength} bytes`);
  console.log(
    `Compression ratio: ${((1 - compressedBuffer.byteLength / pdfBuffer.byteLength) * 100).toFixed(1)}%`
  );

  return compressedBuffer;
}

/**
 * Validates that a PDF buffer is valid
 */
export function validatePDFBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;

  const header = new Uint8Array(buffer, 0, 4);
  const pdfMagic = [0x25, 0x50, 0x44, 0x46]; // %PDF

  return pdfMagic.every((byte, i) => header[i] === byte);
}

/**
 * Gets the pdfcpu command string for a given preset (for logging/debugging)
 */
export function getPdfcpuCommand(params: CompressionParams): string {
  const { preset, targetDPI, jpegQuality } = params;

  switch (preset) {
    case 'lossless':
      return 'pdfcpu optimize -stats=false input.pdf output.pdf';

    case 'balanced': {
      const dpi = targetDPI || 150;
      const quality = jpegQuality ? Math.round(jpegQuality * 100) : 65;
      return `pdfcpu optimize -dpi ${dpi} -q ${quality} -stats=false input.pdf output.pdf`;
    }

    case 'max': {
      const dpi = targetDPI || 120;
      const quality = jpegQuality ? Math.round(jpegQuality * 100) : 40;
      return `pdfcpu optimize -dpi ${dpi} -q ${quality} -stats=false input.pdf output.pdf`;
    }
  }
}
