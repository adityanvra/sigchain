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
/**
 * Helper to convert any Buffer, BSON Binary, or Uint8Array into a fresh, dedicated
 * Uint8Array whose byteOffset is strictly 0 and whose underlying ArrayBuffer matches
 * its length. This fixes a known pdf-lib JpegEmbedder bug where pdf-lib creates
 * new DataView(imageData.buffer) without passing imageData.byteOffset, causing
 * "SOI not found in JPEG" errors when Node buffers share an internal pool.
 */
function toDedicatedUint8Array(input: Buffer | Uint8Array | any): Uint8Array {
  const buf: Buffer = Buffer.isBuffer(input)
    ? input
    : input?.value
    ? input.value()
    : Buffer.from(input);
  const dedicated = new Uint8Array(buf.length);
  dedicated.set(buf);
  return dedicated;
}

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

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error(
      `Page index ${pageIndex} is out of range (PDF has ${pages.length} pages).`
    );
  }

  const targetPage: PDFPage = pages[pageIndex];
  const { height: pageHeight } = targetPage.getSize();

  // Create clean, dedicated Uint8Array with byteOffset === 0
  const dedicatedSig = toDedicatedUint8Array(signatureImageBuffer);

  // Detect image type by magic bytes:
  // PNG magic bytes: 0x89 0x50 0x4E 0x47 (\x89PNG)
  // JPEG magic bytes: 0xFF 0xD8 (\xFF\xD8)
  const isPng =
    dedicatedSig.length >= 4 &&
    dedicatedSig[0] === 0x89 &&
    dedicatedSig[1] === 0x50 &&
    dedicatedSig[2] === 0x4E &&
    dedicatedSig[3] === 0x47;

  let sigImage;
  if (isPng || signatureMimeType.includes("png")) {
    sigImage = await pdfDoc.embedPng(dedicatedSig);
  } else {
    sigImage = await pdfDoc.embedJpg(dedicatedSig);
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
