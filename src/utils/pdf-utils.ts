import { PDFDocument } from 'pdf-lib';

/**
 * PDF magic bytes for validation
 */
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * Validates if the given ArrayBuffer is a valid PDF
 */
export function isValidPDF(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) {
    return false;
  }

  const bytes = new Uint8Array(buffer, 0, 4);
  return PDF_MAGIC_BYTES.every((byte, index) => bytes[index] === byte);
}

/**
 * Counts the number of pages in a PDF
 */
export async function countPages(buffer: ArrayBuffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    return pdfDoc.getPageCount();
  } catch (error) {
    throw new Error(`Failed to count pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts a range of pages from a PDF
 * @param buffer Source PDF as ArrayBuffer
 * @param startPage Starting page (0-indexed)
 * @param endPage Ending page (0-indexed, exclusive)
 * @returns New PDF with extracted pages as ArrayBuffer
 */
export async function extractPages(
  buffer: ArrayBuffer,
  startPage: number,
  endPage: number
): Promise<ArrayBuffer> {
  try {
    const sourcePdf = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });

    const destPdf = await PDFDocument.create();

    const pageCount = sourcePdf.getPageCount();
    const actualEndPage = Math.min(endPage, pageCount);

    // Copy pages
    const pageIndices = Array.from(
      { length: actualEndPage - startPage },
      (_, i) => startPage + i
    );

    const copiedPages = await destPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => destPdf.addPage(page));

    const pdfBytes = await destPdf.save();
    return pdfBytes.buffer;
  } catch (error) {
    throw new Error(`Failed to extract pages ${startPage}-${endPage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Merges multiple PDF ArrayBuffers into a single PDF
 */
export async function mergePDFs(
  chunks: ArrayBuffer[],
  metadata?: Record<string, any>
): Promise<ArrayBuffer> {
  try {
    const mergedPdf = await PDFDocument.create();

    // Set metadata if provided
    if (metadata) {
      if (metadata.title) mergedPdf.setTitle(metadata.title);
      if (metadata.author) mergedPdf.setAuthor(metadata.author);
      if (metadata.subject) mergedPdf.setSubject(metadata.subject);
      if (metadata.keywords) mergedPdf.setKeywords(metadata.keywords);
      if (metadata.creator) mergedPdf.setCreator(metadata.creator);
      if (metadata.producer) mergedPdf.setProducer(metadata.producer);
    }

    // Merge all chunks
    for (const chunk of chunks) {
      const chunkPdf = await PDFDocument.load(chunk, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      });

      const pageIndices = Array.from(
        { length: chunkPdf.getPageCount() },
        (_, i) => i
      );

      const copiedPages = await mergedPdf.copyPages(chunkPdf, pageIndices);
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    return pdfBytes.buffer;
  } catch (error) {
    throw new Error(`Failed to merge PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts metadata from a PDF
 */
export async function extractMetadata(
  buffer: ArrayBuffer
): Promise<Record<string, any>> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });

    return {
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      keywords: pdfDoc.getKeywords(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
    };
  } catch (error) {
    console.warn('Failed to extract metadata:', error);
    return {};
  }
}

/**
 * Calculates optimal chunk size based on PDF size and page count
 */
export function calculateChunkSize(
  totalPages: number,
  fileSizeBytes: number,
  defaultChunkSize: number = 10
): number {
  // For mobile devices or very large files, use smaller chunks
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const avgPageSize = fileSizeBytes / totalPages;

  // If average page size is > 5MB (likely scanned documents), use smaller chunks
  if (avgPageSize > 5 * 1024 * 1024 || isMobile) {
    return Math.min(5, defaultChunkSize);
  }

  // For very large documents (> 500 pages), use smaller chunks
  if (totalPages > 500) {
    return Math.min(5, defaultChunkSize);
  }

  return defaultChunkSize;
}
