import { PDFDocument, PDFPage } from "pdf-lib";

export interface ApplySignatureParams {
  pdfBuffer: Buffer;
  signatureImageBuffer: Buffer;
  signatureMimeType: string;
  /** 0-indexed page number */
  page: number;
  /** Distance from left edge of page (in points) */
  x: number;
  /** Distance from top edge of page (in points) — we convert to PDF bottom-origin internally */
  y: number;
  width: number;
  height: number;
}

/**
 * Embeds a signature image (PNG/JPEG) into a PDF at the specified position.
 * Returns the modified PDF as a Buffer.
 *
 * The image can be a handwritten signature PNG or a QR code PNG — the
 * Akademisi chooses what to upload in their profile.
 *
 * Coordinate convention: (x, y) is measured from the TOP-LEFT corner of the
 * page (matching canvas/screen coords).  Conversion to pdf-lib's bottom-origin
 * system is handled internally.
 */
export async function applySignatureToPdf(params: ApplySignatureParams): Promise<Buffer> {
  const {
    pdfBuffer,
    signatureImageBuffer,
    signatureMimeType,
    page: pageIndex,
    x,
    y,
    width,
    height,
  } = params;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(
      `Page index ${pageIndex} is out of range (PDF has ${pages.length} pages).`
    );
  }

  const targetPage: PDFPage = pages[pageIndex];
  const { height: pageHeight } = targetPage.getSize();

  // Embed signature image
  let sigImage;
  const isJpeg = signatureMimeType.includes("jpeg") || signatureMimeType.includes("jpg");
  if (isJpeg) {
    sigImage = await pdfDoc.embedJpg(signatureImageBuffer);
  } else {
    sigImage = await pdfDoc.embedPng(signatureImageBuffer);
  }

  // Convert from top-origin (screen) to bottom-origin (PDF)
  const pdfY = pageHeight - y - height;

  targetPage.drawImage(sigImage, {
    x,
    y: pdfY,
    width,
    height,
    opacity: 1,
  });

  const signedBytes = await pdfDoc.save();
  return Buffer.from(signedBytes);
}

/**
 * Returns the page count of a PDF buffer without fully loading it for editing.
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Returns basic page dimensions for each page in the PDF.
 */
export async function getPdfPageSizes(
  pdfBuffer: Buffer
): Promise<Array<{ width: number; height: number }>> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return pdfDoc.getPages().map((p) => p.getSize());
}
