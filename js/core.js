/* ===== Core utilities: PRNG, smooth noise, SHA-256, event bus, formatting ===== */

// Deterministic PRNG (seeded)
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hash01(seed, key, i) {
  let h = hashStr(key) ^ Math.imul(seed | 0, 0x9E3779B1) ^ Math.imul(i | 0, 0x85EBCA77);
  h = Math.imul(h ^ h >>> 16, 0x7feb352d); h = Math.imul(h ^ h >>> 15, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Pure function of (seed, key, x): telemetry never consumes the event PRNG, so logs stay reproducible.
function noise1(seed, key, x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); const a = hash01(seed, key, i), b = hash01(seed, key, i + 1); return (a + (b - a) * u) * 2 - 1; }
function fnoise(seed, key, x) { return noise1(seed, key, x) * 0.7 + noise1(seed, key + "#", x * 3.1) * 0.3; }

// Synchronous SHA-256 (hex)
function sha256(str) {
  const ascii = unescape(encodeURIComponent(str));
  const rr = (v, a) => (v >>> a) | (v << (32 - a));
  const maxWord = 4294967296; const words = []; const bitLen = ascii.length * 8;
  let hash = [], k = [], pc = 0; const comp = {};
  for (let c = 2; pc < 64; c++) {
    if (!comp[c]) { for (let i = 0; i < 313; i += c) comp[i] = c; hash[pc] = (Math.pow(c, .5) * maxWord) | 0; k[pc++] = (Math.pow(c, 1 / 3) * maxWord) | 0; }
  }
  hash = hash.slice(0, 8);
  let s = ascii + "\x80"; while (s.length % 64 - 56) s += "\x00";
  for (let i = 0; i < s.length; i++) words[i >> 2] |= s.charCodeAt(i) << ((3 - i) % 4) * 8;
  words[words.length] = (bitLen / maxWord) | 0; words[words.length] = bitLen;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16); const old = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
        (w[i] = (i < 16) ? (w[i] | 0) : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0; hash.length = 8;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; out += (b < 16 ? "0" : "") + b.toString(16); }
  return out;
}

// Tiny event bus. A real node publishing over WebSocket would call bus.emit('log', ev) with the same schema.
function createBus() {
  const h = {};
  return { on(e, f) { (h[e] = h[e] || []).push(f); }, emit(e, d) { (h[e] || []).forEach(f => f(d)); } };
}

// Formatting
const pad2 = n => String(n).padStart(2, "0");
function fmtT(t) { const m = Math.floor(t / 60), s = t - m * 60; return `T+${pad2(m)}:${s.toFixed(1).padStart(4, "0")}`; }
function fmtBytes(b) {
  if (b < 1024) return `${Math.round(b)} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
};
