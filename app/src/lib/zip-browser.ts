/** Browser-side counterpart to src/lib/zip.ts, which relies on Node's
 * `Buffer` (unavailable client-side without a polyfill Next.js doesn't
 * ship by default). Used for bundling multiple canvas-rendered images
 * into one download without a server round-trip. */

export type ZipEntryInput = { bytes: Uint8Array; fileName: string };

export function createZipBlob(entries: ZipEntryInput[]): Blob {
  const parts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const fileNameBytes = new TextEncoder().encode(entry.fileName);
    const bytes = entry.bytes;
    const crc = crc32(bytes);

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, 0x0800, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, bytes.length, true);
    localHeader.setUint32(22, bytes.length, true);
    localHeader.setUint16(26, fileNameBytes.length, true);
    parts.push(localHeader.buffer, fileNameBytes, bytes as BlobPart);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, 0x0800, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, bytes.length, true);
    centralHeader.setUint32(24, bytes.length, true);
    centralHeader.setUint16(28, fileNameBytes.length, true);
    centralHeader.setUint32(42, offset, true);
    centralParts.push(centralHeader.buffer, fileNameBytes);
    centralSize += centralHeader.byteLength + fileNameBytes.length;

    offset += localHeader.byteLength + fileNameBytes.length + bytes.length;
  }

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...centralParts, end.buffer], {
    type: "application/zip",
  });
}

const crcTable = buildCrcTable();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}
