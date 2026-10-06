// Read-only: GETs each URL in URLS (whitespace/comma separated) and prints
// status, content-type, byte size, sha1 and (jpg/png) pixel size. Used to tell
// a real design snapshot from a placeholder on 3d-preview order lines.
const crypto = require('crypto');
function dims(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`;
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return '?';
}
(async () => {
  for (const u of (process.env.URLS || '').split(/[\s,]+/).filter(Boolean)) {
    try {
      const r = await fetch(u);
      const b = Buffer.from(await r.arrayBuffer());
      console.log(`${r.status} ${r.headers.get('content-type')} ${b.length}B ${dims(b)} sha1=${crypto.createHash('sha1').update(b).digest('hex').slice(0, 10)} ${u}`);
    } catch (e) { console.log(`ERR ${e.message} ${u}`); }
  }
})();
