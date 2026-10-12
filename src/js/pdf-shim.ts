// pdfjs-dist v6 relies on the Uint8Array to/from base64+hex proposal,
// which Chrome/Edge only shipped in v140. Patch for older browsers.
const proto = Uint8Array.prototype as any;
const Ctor = Uint8Array as any;

export {};

if (typeof proto.toHex !== 'function') {
  proto.toHex = function (this: Uint8Array) {
    let s = '';
    for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, '0');
    return s;
  };
}

if (typeof proto.toBase64 !== 'function') {
  proto.toBase64 = function (this: Uint8Array) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < this.length; i += CHUNK) {
      bin += String.fromCharCode(...this.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  };
}

if (typeof Ctor.fromBase64 !== 'function') {
  Ctor.fromBase64 = function (s: string) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
}

// Map.getOrInsert / Map.getOrInsertComputed (also Chrome 140+).
for (const C of [Map, WeakMap] as any[]) {
  const p = C.prototype;
  if (typeof p.getOrInsert !== 'function') {
    p.getOrInsert = function (key: any, value: any) {
      if (!this.has(key)) this.set(key, value);
      return this.get(key);
    };
  }
  if (typeof p.getOrInsertComputed !== 'function') {
    p.getOrInsertComputed = function (key: any, fn: (k: any) => any) {
      if (!this.has(key)) this.set(key, fn(key));
      return this.get(key);
    };
  }
}

