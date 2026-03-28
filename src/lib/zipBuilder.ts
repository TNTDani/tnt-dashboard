// Pure-JS ZIP builder (Store method, no compression)
// Produces a valid ZIP file without any external dependencies.

export interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// CRC-32 table + computation
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// DOS date/time encoding
// ---------------------------------------------------------------------------
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// ---------------------------------------------------------------------------
// Write little-endian integers into a DataView
// ---------------------------------------------------------------------------
function u16(v: DataView, off: number, val: number) { v.setUint16(off, val, true); }
function u32(v: DataView, off: number, val: number) { v.setUint32(off, val, true); }

// ---------------------------------------------------------------------------
// buildZip — public API
// ---------------------------------------------------------------------------
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const now = dosDateTime(new Date());

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const name = enc.encode(entry.filename);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    // ----- Local file header (30 bytes + name) -----
    const lh = new Uint8Array(30 + name.length);
    const lv = new DataView(lh.buffer);
    u32(lv, 0, 0x04034b50);   // signature
    u16(lv, 4, 20);            // version needed (2.0)
    u16(lv, 6, 0);             // general purpose flags
    u16(lv, 8, 0);             // compression method: Store
    u16(lv, 10, now.time);     // last mod time
    u16(lv, 12, now.date);     // last mod date
    u32(lv, 14, crc);          // crc-32
    u32(lv, 18, size);         // compressed size
    u32(lv, 22, size);         // uncompressed size
    u16(lv, 26, name.length);  // file name length
    u16(lv, 28, 0);            // extra field length
    lh.set(name, 30);

    offsets.push(currentOffset);
    localParts.push(lh, data);
    currentOffset += lh.length + data.length;

    // ----- Central directory header (46 bytes + name) -----
    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    u32(cv, 0, 0x02014b50);    // signature
    u16(cv, 4, 20);             // version made by
    u16(cv, 6, 20);             // version needed
    u16(cv, 8, 0);              // flags
    u16(cv, 10, 0);             // compression: Store
    u16(cv, 12, now.time);      // mod time
    u16(cv, 14, now.date);      // mod date
    u32(cv, 16, crc);           // crc-32
    u32(cv, 20, size);          // compressed size
    u32(cv, 24, size);          // uncompressed size
    u16(cv, 28, name.length);   // file name length
    u16(cv, 30, 0);             // extra field length
    u16(cv, 32, 0);             // file comment length
    u16(cv, 34, 0);             // disk number start
    u16(cv, 36, 0);             // internal file attributes
    u32(cv, 38, 0);             // external file attributes
    u32(cv, 42, offsets[offsets.length - 1]); // relative offset of local header
    ch.set(name, 46);

    centralParts.push(ch);
  }

  // ----- End of central directory record (22 bytes) -----
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  u32(ev, 0, 0x06054b50);      // signature
  u16(ev, 4, 0);                // disk number
  u16(ev, 6, 0);                // disk with central dir start
  u16(ev, 8, entries.length);   // entries on this disk
  u16(ev, 10, entries.length);  // total entries
  u32(ev, 12, centralSize);     // size of central directory
  u32(ev, 16, currentOffset);   // offset of central directory
  u16(ev, 20, 0);               // comment length

  // ----- Assemble -----
  const totalSize = currentOffset + centralSize + eocd.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}
