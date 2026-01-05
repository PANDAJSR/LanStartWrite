const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function _crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _buildZipStore(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const ent of entries) {
    const name = String(ent && ent.name || '').replace(/\\/g, '/');
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = Buffer.isBuffer(ent && ent.data) ? ent.data : Buffer.from(String(ent && ent.data || ''), 'utf8');
    const crc = _crc32(dataBuf);
    const size = dataBuf.length >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    parts.push(local, nameBuf, dataBuf);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(size, 20);
    cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset >>> 0, 42);

    central.push(cen, nameBuf);

    offset += local.length + nameBuf.length + dataBuf.length;
  }

  const centralOffset = offset >>> 0;
  const centralSize = central.reduce((n, b) => n + b.length, 0) >>> 0;
  const totalEntries = entries.length >>> 0;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(totalEntries, 8);
  end.writeUInt16LE(totalEntries, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...central, end]);
}

function _readFile(filePath) {
  return fs.readFileSync(filePath);
}

function _calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function _calculateResources(pluginDir, files) {
  const resources = [];
  
  for (const file of files) {
    if (file === 'manifest.json') continue;
    
    const filePath = path.join(pluginDir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile()) {
      const data = _readFile(filePath);
      const sha256 = _calculateSha256(data);
      
      resources.push({
        path: file,
        size: data.length,
        sha256: sha256
      });
    }
  }
  
  return resources;
}

function _getAllFiles(dir, baseDir = dir) {
  const files = [];
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(..._getAllFiles(fullPath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(relativePath);
    }
  }
  
  return files;
}

async function _buildLanmod(pluginDir, outputPath) {
  console.log(`正在打包插件: ${pluginDir}`);
  
  const manifestPath = path.join(pluginDir, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json 不存在于 ${pluginDir}`);
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`插件 ID: ${manifest.id}`);
  console.log(`插件名称: ${manifest.name}`);
  console.log(`插件版本: ${manifest.version}`);
  
  const allFiles = _getAllFiles(pluginDir);
  console.log(`找到 ${allFiles.length} 个文件`);
  
  const resources = await _calculateResources(pluginDir, allFiles);
  
  if (resources.length > 0) {
    manifest.resources = resources;
    console.log(`添加了 ${resources.length} 个资源到 manifest`);
  }
  
  const entries = [];
  
  for (const file of allFiles) {
    const filePath = path.join(pluginDir, file);
    const data = _readFile(filePath);
    
    if (file === 'manifest.json') {
      entries.push({
        name: file,
        data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
      });
    } else {
      entries.push({
        name: file,
        data: data
      });
    }
  }
  
  const zipBuf = _buildZipStore(entries);
  
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, zipBuf);
  
  console.log(`\n✓ 插件打包成功!`);
  console.log(`  输出文件: ${outputPath}`);
  console.log(`  文件大小: ${(zipBuf.length / 1024).toFixed(2)} KB`);
  console.log(`  包含文件: ${allFiles.length} 个`);
  
  return {
    success: true,
    path: outputPath,
    size: zipBuf.length,
    fileCount: allFiles.length
  };
}

const pluginDir = path.join(__dirname, 'mod', 'plugins', 'inkcanvas-comprehensive');
const outputPath = path.join(__dirname, 'inkcanvas-comprehensive-2.0.0.lanmod');

_buildLanmod(pluginDir, outputPath).catch(err => {
  console.error('打包失败:', err.message);
  process.exit(1);
});
