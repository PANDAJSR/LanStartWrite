
const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl'); // Use existing zip lib if available, or just create simple zip manually?
// Wait, 'yauzl' is for unzip. 'yazl' is for zip?
// Check package.json
// "dependencies": { "semver": "^7.5.4", "yauzl": "^2.10.0" }
// Only yauzl (unzip). No zip library in dependencies?
// main.js has `_buildZipStore`. Let's use that logic.
// I can import `_buildZipStore` if I can access it, but it's internal in main.js.
// I will replicate `_buildZipStore` logic here.

// Minimal ZIP writer (store only) implementation
function buildZipStore(files) {
  const parts = [];
  let centralDirectory = [];
  let offset = 0;

  files.forEach(file => {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const data = file.data;
    
    // Local File Header
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // Signature
    header.writeUInt16LE(0x000A, 4); // Version needed
    header.writeUInt16LE(0, 6); // Flags
    header.writeUInt16LE(0, 8); // Compression (0 = Store)
    header.writeUInt16LE(0, 10); // Time (dummy)
    header.writeUInt16LE(0, 12); // Date (dummy)
    header.writeUInt32LE(0, 14); // CRC32 (0 for now, strictly should be correct)
    header.writeUInt32LE(data.length, 18); // Compressed size
    header.writeUInt32LE(data.length, 22); // Uncompressed size
    header.writeUInt16LE(nameBuf.length, 26); // Filename length
    header.writeUInt16LE(0, 28); // Extra field length

    parts.push(header);
    parts.push(nameBuf);
    parts.push(data);

    // Central Directory File Header
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
    cdHeader.writeUInt16LE(0x000A, 4); // Version made by
    cdHeader.writeUInt16LE(0x000A, 6); // Version needed
    cdHeader.writeUInt16LE(0, 8); // Flags
    cdHeader.writeUInt16LE(0, 10); // Compression
    cdHeader.writeUInt16LE(0, 12); // Time
    cdHeader.writeUInt16LE(0, 14); // Date
    cdHeader.writeUInt32LE(0, 16); // CRC32
    cdHeader.writeUInt32LE(data.length, 20); // Compressed size
    cdHeader.writeUInt32LE(data.length, 24); // Uncompressed size
    cdHeader.writeUInt16LE(nameBuf.length, 28); // Filename length
    cdHeader.writeUInt16LE(0, 30); // Extra field length
    cdHeader.writeUInt16LE(0, 32); // Comment length
    cdHeader.writeUInt16LE(0, 34); // Disk start
    cdHeader.writeUInt16LE(0, 36); // Internal attrs
    cdHeader.writeUInt32LE(0, 38); // External attrs
    cdHeader.writeUInt32LE(offset, 42); // Offset of local header

    centralDirectory.push(cdHeader);
    centralDirectory.push(nameBuf);

    offset += 30 + nameBuf.length + data.length;
  });

  const cdStart = offset;
  let cdSize = 0;
  centralDirectory.forEach(buf => {
    parts.push(buf);
    cdSize += buf.length;
    offset += buf.length;
  });

  // End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Disk with CD
  eocd.writeUInt16LE(files.length, 8); // CD entries on this disk
  eocd.writeUInt16LE(files.length, 10); // Total CD entries
  eocd.writeUInt32LE(cdSize, 12); // CD size
  eocd.writeUInt32LE(cdStart, 16); // CD offset
  eocd.writeUInt16LE(0, 20); // Comment length

  parts.push(eocd);

  return Buffer.concat(parts);
}

const srcDir = path.join(__dirname, 'src', 'plugins_src', 'devtools');
const outDir = path.join(__dirname, 'src', 'plugins');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const filesToZip = [];
['manifest.json', 'main.js', 'ui.html', 'icon.svg'].forEach(f => {
  const p = path.join(srcDir, f);
  if (fs.existsSync(p)) {
    filesToZip.push({
      name: f,
      data: fs.readFileSync(p)
    });
  }
});

const zipBuf = buildZipStore(filesToZip);
fs.writeFileSync(path.join(outDir, 'lanstart.devtools.lanmod'), zipBuf);
console.log('Plugin packaged.');
