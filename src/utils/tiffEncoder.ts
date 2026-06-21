/**
 * Client-side TIFF encoder with DPI metadata.
 * Produces an uncompressed RGBA TIFF file (little-endian byte order).
 */

// TIFF IFD value types
const TYPE_SHORT = 3;    // 2 bytes
const TYPE_LONG = 4;     // 4 bytes
const TYPE_RATIONAL = 5; // 8 bytes (numerator + denominator)

// TIFF tag IDs
const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_PHOTOMETRIC = 262;
const TAG_STRIP_OFFSETS = 273;
const TAG_SAMPLES_PER_PIXEL = 277;
const TAG_ROWS_PER_STRIP = 278;
const TAG_STRIP_BYTE_COUNTS = 279;
const TAG_X_RESOLUTION = 282;
const TAG_Y_RESOLUTION = 283;
const TAG_RESOLUTION_UNIT = 296;

function writeUint16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

/**
 * Write an IFD entry (12 bytes).
 * For values that fit in 4 bytes (SHORT, LONG with count=1), the value is stored inline.
 * Otherwise, the value field holds an offset to the actual data.
 */
function writeIFDEntry(
  view: DataView,
  offset: number,
  tag: number,
  type: number,
  count: number,
  valueOrOffset: number,
): void {
  writeUint16LE(view, offset, tag);
  writeUint16LE(view, offset + 2, type);
  writeUint32LE(view, offset + 4, count);
  writeUint32LE(view, offset + 8, valueOrOffset);
}

/**
 * Encode RGBA pixel data as a TIFF file with the specified DPI.
 *
 * @param data   - RGBA pixel data (Uint8Array, length = width * height * 4)
 * @param width  - Image width in pixels
 * @param height - Image height in pixels
 * @param dpi    - Resolution in dots per inch (default 300)
 * @returns Blob with MIME type 'image/tiff'
 */
export function encodeTiff(
  data: Uint8Array,
  width: number,
  height: number,
  dpi: number = 300,
): Blob {
  if (!data || data.length === 0 || width <= 0 || height <= 0) {
    throw new Error('Invalid image data: empty data or zero dimensions');
  }

  const expectedLength = width * height * 4;
  if (data.length < expectedLength) {
    throw new Error(
      `Image data too short: expected ${expectedLength} bytes, got ${data.length}`,
    );
  }

  // Layout:
  //   [0..7]       Header (8 bytes)
  //   [8..9]       IFD entry count (2 bytes)
  //   [10..157]    12 IFD entries (12 * 12 = 144 bytes)
  //   [158..161]   Next IFD offset = 0 (4 bytes)
  //   [162..169]   XResolution RATIONAL (8 bytes)
  //   [170..177]   YResolution RATIONAL (8 bytes)
  //   [178..185]   BitsPerSample x4 SHORT values (8 bytes, padded)
  //   [186..]      Image strip data

  const HEADER_SIZE = 8;
  const IFD_COUNT = 12;
  const IFD_ENTRIES_SIZE = IFD_COUNT * 12;
  const IFD_SIZE = 2 + IFD_ENTRIES_SIZE + 4; // count + entries + next offset

  const ifdOffset = HEADER_SIZE;
  const rationalDataOffset = ifdOffset + IFD_SIZE;
  const xResOffset = rationalDataOffset;
  const yResOffset = xResOffset + 8;
  const bitsPerSampleOffset = yResOffset + 8;
  const imageDataOffset = bitsPerSampleOffset + 8;

  const imageDataSize = width * height * 4;
  const totalSize = imageDataOffset + imageDataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // --- TIFF Header ---
  // Byte order: "II" = little-endian
  view.setUint8(0, 0x49); // 'I'
  view.setUint8(1, 0x49); // 'I'
  // Magic number: 42
  writeUint16LE(view, 2, 42);
  // Offset to first IFD
  writeUint32LE(view, 4, ifdOffset);

  // --- IFD ---
  writeUint16LE(view, ifdOffset, IFD_COUNT);

  let entryOffset = ifdOffset + 2;

  // 1. ImageWidth (LONG, count=1, value=width)
  writeIFDEntry(view, entryOffset, TAG_IMAGE_WIDTH, TYPE_LONG, 1, width);
  entryOffset += 12;

  // 2. ImageLength (LONG, count=1, value=height)
  writeIFDEntry(view, entryOffset, TAG_IMAGE_LENGTH, TYPE_LONG, 1, height);
  entryOffset += 12;

  // 3. BitsPerSample (SHORT, count=4, offset to 4 SHORT values)
  writeIFDEntry(view, entryOffset, TAG_BITS_PER_SAMPLE, TYPE_SHORT, 4, bitsPerSampleOffset);
  entryOffset += 12;

  // 4. Compression (SHORT, count=1, value=1 = no compression)
  writeIFDEntry(view, entryOffset, TAG_COMPRESSION, TYPE_SHORT, 1, 1);
  entryOffset += 12;

  // 5. PhotometricInterpretation (SHORT, count=1, value=2 = RGB)
  writeIFDEntry(view, entryOffset, TAG_PHOTOMETRIC, TYPE_SHORT, 1, 2);
  entryOffset += 12;

  // 6. StripOffsets (LONG, count=1, offset to image data)
  writeIFDEntry(view, entryOffset, TAG_STRIP_OFFSETS, TYPE_LONG, 1, imageDataOffset);
  entryOffset += 12;

  // 7. SamplesPerPixel (SHORT, count=1, value=4 for RGBA)
  writeIFDEntry(view, entryOffset, TAG_SAMPLES_PER_PIXEL, TYPE_SHORT, 1, 4);
  entryOffset += 12;

  // 8. RowsPerStrip (LONG, count=1, value=height = single strip)
  writeIFDEntry(view, entryOffset, TAG_ROWS_PER_STRIP, TYPE_LONG, 1, height);
  entryOffset += 12;

  // 9. StripByteCounts (LONG, count=1, total image data size)
  writeIFDEntry(view, entryOffset, TAG_STRIP_BYTE_COUNTS, TYPE_LONG, 1, imageDataSize);
  entryOffset += 12;

  // 10. XResolution (RATIONAL, count=1, offset)
  writeIFDEntry(view, entryOffset, TAG_X_RESOLUTION, TYPE_RATIONAL, 1, xResOffset);
  entryOffset += 12;

  // 11. YResolution (RATIONAL, count=1, offset)
  writeIFDEntry(view, entryOffset, TAG_Y_RESOLUTION, TYPE_RATIONAL, 1, yResOffset);
  entryOffset += 12;

  // 12. ResolutionUnit (SHORT, count=1, value=2 = inch)
  writeIFDEntry(view, entryOffset, TAG_RESOLUTION_UNIT, TYPE_SHORT, 1, 2);
  entryOffset += 12;

  // Next IFD offset = 0 (no more IFDs)
  writeUint32LE(view, entryOffset, 0);

  // --- Extra data referenced by IFD entries ---

  // XResolution: dpi/1 as RATIONAL
  writeUint32LE(view, xResOffset, dpi);
  writeUint32LE(view, xResOffset + 4, 1);

  // YResolution: dpi/1 as RATIONAL
  writeUint32LE(view, yResOffset, dpi);
  writeUint32LE(view, yResOffset + 4, 1);

  // BitsPerSample: 4 SHORT values [8, 8, 8, 8] for RGBA
  writeUint16LE(view, bitsPerSampleOffset, 8);
  writeUint16LE(view, bitsPerSampleOffset + 2, 8);
  writeUint16LE(view, bitsPerSampleOffset + 4, 8);
  writeUint16LE(view, bitsPerSampleOffset + 6, 8);

  // --- Image data ---
  const imageBytes = new Uint8Array(buffer, imageDataOffset, imageDataSize);
  imageBytes.set(data.subarray(0, imageDataSize));

  return new Blob([buffer], { type: 'image/tiff' });
}
