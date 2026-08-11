// src/bytes/encoding.ts
function partition(bytes, size) {
  const partitions = [];
  for (let i = 0; i < bytes.length; i += size) {
    partitions.push(bytes.subarray(i, i + size));
  }
  return partitions;
}
function equals(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
function commonPrefix(one, other) {
  const length = Math.min(one.length, other.length);
  for (let i = 0; i < length; i++) {
    if (one[i] !== other[i]) {
      return one.subarray(0, i);
    }
  }
  return one.subarray(0, length);
}
function indexOf(bytes, value, start = 0) {
  for (let i = start; i < bytes.length; i++) {
    for (let j = 0; j < value.length; j++) {
      if (bytes[i + j] !== value[j]) {
        break;
      }
      if (j === value.length - 1) {
        return i;
      }
    }
  }
  return -1;
}
function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function hexToUint8Array(hex) {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  const result = new Uint8Array(clean.length / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}
var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function baseToUint8Array(baseString, baseChars) {
  const padding = "=";
  const base = baseChars.length;
  let bits = 0;
  let value = 0;
  const array = [];
  for (let i = 0; i < baseString.length; i++) {
    const character = baseString.charAt(i);
    if (character === padding) {
      break;
    }
    const index = baseChars.indexOf(character);
    if (index === -1) {
      throw new Error(`Invalid character: ${character}`);
    }
    value = value << Math.log2(base) | index;
    bits += Math.log2(base);
    if (bits >= 8) {
      bits -= 8;
      array.push(value >> bits & 255);
    }
  }
  return new Uint8Array(array);
}
function uint8ArrayToBase(bytes, baseChars) {
  const base = baseChars.length;
  let bits = 0;
  let value = 0;
  let result = "";
  for (const byte of bytes) {
    value = value << 8 | byte;
    bits += 8;
    while (bits >= Math.log2(base)) {
      bits -= Math.log2(base);
      result += baseChars.charAt(value >> bits & base - 1);
    }
  }
  if (bits > 0) {
    result += baseChars.charAt(value << Math.log2(base) - bits & base - 1);
  }
  if (result.length % 4 !== 0) {
    result += "=".repeat(4 - result.length % 4);
  }
  return result;
}
function uint8ArrayToBase64(bytes) {
  return uint8ArrayToBase(bytes, BASE64_CHARS);
}
function base32ToUint8Array(base32) {
  return baseToUint8Array(base32, BASE32_CHARS);
}
function uint8ArrayToBase32(bytes) {
  return uint8ArrayToBase(bytes, BASE32_CHARS);
}
function numberToUint8(value) {
  return new Uint8Array([value]);
}
function uint8ToNumber(bytes) {
  return bytes[0];
}
function numberToUint16(value, endian) {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, value, endian === "LE");
  return new Uint8Array(buffer);
}
function uint16ToNumber(bytes, endian) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0, endian === "LE");
}
function numberToUint64(value, endian) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, value, endian === "LE");
  return new Uint8Array(buffer);
}

// src/crypto/keccak.ts
var IOTA_CONSTANTS = [
  0,
  1,
  0,
  32898,
  2147483648,
  32906,
  2147483648,
  2147516416,
  0,
  32907,
  0,
  2147483649,
  2147483648,
  2147516545,
  2147483648,
  32777,
  0,
  138,
  0,
  136,
  0,
  2147516425,
  0,
  2147483658,
  0,
  2147516555,
  2147483648,
  139,
  2147483648,
  32905,
  2147483648,
  32771,
  2147483648,
  32770,
  2147483648,
  128,
  0,
  32778,
  2147483648,
  2147483658,
  2147483648,
  2147516545,
  2147483648,
  32896,
  0,
  2147483649,
  2147483648,
  2147516424
];
function keccak256(bytes) {
  return squeeze(absorb(new Array(50).fill(0), divideToBlocks(bytes, 1)));
}
function absorb(state, blocks) {
  for (const block of blocks) {
    for (let i = 0; i < 34; i += 2) {
      state[i] = state[i] ^ block[i + 1];
      state[i + 1] = state[i + 1] ^ block[i];
    }
    keccakPermutate(state);
  }
  return state;
}
function keccakPermutate(state) {
  for (let round = 0; round < 24; round++) {
    const thetaC0 = state[0] ^ state[10] ^ state[20] ^ state[30] ^ state[40];
    const thetaC1 = state[1] ^ state[11] ^ state[21] ^ state[31] ^ state[41];
    const thetaC2 = state[2] ^ state[12] ^ state[22] ^ state[32] ^ state[42];
    const thetaC3 = state[3] ^ state[13] ^ state[23] ^ state[33] ^ state[43];
    const thetaC4 = state[4] ^ state[14] ^ state[24] ^ state[34] ^ state[44];
    const thetaC5 = state[5] ^ state[15] ^ state[25] ^ state[35] ^ state[45];
    const thetaC6 = state[6] ^ state[16] ^ state[26] ^ state[36] ^ state[46];
    const thetaC7 = state[7] ^ state[17] ^ state[27] ^ state[37] ^ state[47];
    const thetaC8 = state[8] ^ state[18] ^ state[28] ^ state[38] ^ state[48];
    const thetaC9 = state[9] ^ state[19] ^ state[29] ^ state[39] ^ state[49];
    const rotLow0 = thetaC2 << 1 | thetaC3 >>> 31;
    const rotHigh0 = thetaC3 << 1 | thetaC2 >>> 31;
    const thetaD0 = thetaC8 ^ rotLow0;
    const thetaD1 = thetaC9 ^ rotHigh0;
    const rotLow1 = thetaC4 << 1 | thetaC5 >>> 31;
    const rotHigh1 = thetaC5 << 1 | thetaC4 >>> 31;
    const thetaD2 = thetaC0 ^ rotLow1;
    const thetaD3 = thetaC1 ^ rotHigh1;
    const rotLow2 = thetaC6 << 1 | thetaC7 >>> 31;
    const rotHigh2 = thetaC7 << 1 | thetaC6 >>> 31;
    const thetaD4 = thetaC2 ^ rotLow2;
    const thetaD5 = thetaC3 ^ rotHigh2;
    const rotLow3 = thetaC8 << 1 | thetaC9 >>> 31;
    const rotHigh3 = thetaC9 << 1 | thetaC8 >>> 31;
    const thetaD6 = thetaC4 ^ rotLow3;
    const thetaD7 = thetaC5 ^ rotHigh3;
    const rotLow4 = thetaC0 << 1 | thetaC1 >>> 31;
    const rotHigh4 = thetaC1 << 1 | thetaC0 >>> 31;
    const thetaD8 = thetaC6 ^ rotLow4;
    const thetaD9 = thetaC7 ^ rotHigh4;
    state[0] ^= thetaD0;
    state[1] ^= thetaD1;
    state[2] ^= thetaD2;
    state[3] ^= thetaD3;
    state[4] ^= thetaD4;
    state[5] ^= thetaD5;
    state[6] ^= thetaD6;
    state[7] ^= thetaD7;
    state[8] ^= thetaD8;
    state[9] ^= thetaD9;
    state[10] ^= thetaD0;
    state[11] ^= thetaD1;
    state[12] ^= thetaD2;
    state[13] ^= thetaD3;
    state[14] ^= thetaD4;
    state[15] ^= thetaD5;
    state[16] ^= thetaD6;
    state[17] ^= thetaD7;
    state[18] ^= thetaD8;
    state[19] ^= thetaD9;
    state[20] ^= thetaD0;
    state[21] ^= thetaD1;
    state[22] ^= thetaD2;
    state[23] ^= thetaD3;
    state[24] ^= thetaD4;
    state[25] ^= thetaD5;
    state[26] ^= thetaD6;
    state[27] ^= thetaD7;
    state[28] ^= thetaD8;
    state[29] ^= thetaD9;
    state[30] ^= thetaD0;
    state[31] ^= thetaD1;
    state[32] ^= thetaD2;
    state[33] ^= thetaD3;
    state[34] ^= thetaD4;
    state[35] ^= thetaD5;
    state[36] ^= thetaD6;
    state[37] ^= thetaD7;
    state[38] ^= thetaD8;
    state[39] ^= thetaD9;
    state[40] ^= thetaD0;
    state[41] ^= thetaD1;
    state[42] ^= thetaD2;
    state[43] ^= thetaD3;
    state[44] ^= thetaD4;
    state[45] ^= thetaD5;
    state[46] ^= thetaD6;
    state[47] ^= thetaD7;
    state[48] ^= thetaD8;
    state[49] ^= thetaD9;
    const piResult0 = state[0];
    const piResult1 = state[1];
    const piResult20 = state[2] << 1 | state[3] >>> 31;
    const piResult21 = state[3] << 1 | state[2] >>> 31;
    const piResult40 = state[5] << 30 | state[4] >>> 2;
    const piResult41 = state[4] << 30 | state[5] >>> 2;
    const piResult10 = state[6] << 28 | state[7] >>> 4;
    const piResult11 = state[7] << 28 | state[6] >>> 4;
    const piResult30 = state[8] << 27 | state[9] >>> 5;
    const piResult31 = state[9] << 27 | state[8] >>> 5;
    const piResult32 = state[11] << 4 | state[10] >>> 28;
    const piResult33 = state[10] << 4 | state[11] >>> 28;
    const piResult2 = state[13] << 12 | state[12] >>> 20;
    const piResult3 = state[12] << 12 | state[13] >>> 20;
    const piResult22 = state[14] << 6 | state[15] >>> 26;
    const piResult23 = state[15] << 6 | state[14] >>> 26;
    const piResult42 = state[17] << 23 | state[16] >>> 9;
    const piResult43 = state[16] << 23 | state[17] >>> 9;
    const piResult12 = state[18] << 20 | state[19] >>> 12;
    const piResult13 = state[19] << 20 | state[18] >>> 12;
    const piResult14 = state[20] << 3 | state[21] >>> 29;
    const piResult15 = state[21] << 3 | state[20] >>> 29;
    const piResult34 = state[22] << 10 | state[23] >>> 22;
    const piResult35 = state[23] << 10 | state[22] >>> 22;
    const piResult4 = state[25] << 11 | state[24] >>> 21;
    const piResult5 = state[24] << 11 | state[25] >>> 21;
    const piResult24 = state[26] << 25 | state[27] >>> 7;
    const piResult25 = state[27] << 25 | state[26] >>> 7;
    const piResult44 = state[29] << 7 | state[28] >>> 25;
    const piResult45 = state[28] << 7 | state[29] >>> 25;
    const piResult46 = state[31] << 9 | state[30] >>> 23;
    const piResult47 = state[30] << 9 | state[31] >>> 23;
    const piResult16 = state[33] << 13 | state[32] >>> 19;
    const piResult17 = state[32] << 13 | state[33] >>> 19;
    const piResult36 = state[34] << 15 | state[35] >>> 17;
    const piResult37 = state[35] << 15 | state[34] >>> 17;
    const piResult6 = state[36] << 21 | state[37] >>> 11;
    const piResult7 = state[37] << 21 | state[36] >>> 11;
    const piResult26 = state[38] << 8 | state[39] >>> 24;
    const piResult27 = state[39] << 8 | state[38] >>> 24;
    const piResult28 = state[40] << 18 | state[41] >>> 14;
    const piResult29 = state[41] << 18 | state[40] >>> 14;
    const piResult48 = state[42] << 2 | state[43] >>> 30;
    const piResult49 = state[43] << 2 | state[42] >>> 30;
    const piResult18 = state[45] << 29 | state[44] >>> 3;
    const piResult19 = state[44] << 29 | state[45] >>> 3;
    const piResult38 = state[47] << 24 | state[46] >>> 8;
    const piResult39 = state[46] << 24 | state[47] >>> 8;
    const piResult8 = state[48] << 14 | state[49] >>> 18;
    const piResult9 = state[49] << 14 | state[48] >>> 18;
    state[0] = piResult0 ^ ~piResult2 & piResult4;
    state[1] = piResult1 ^ ~piResult3 & piResult5;
    state[2] = piResult2 ^ ~piResult4 & piResult6;
    state[3] = piResult3 ^ ~piResult5 & piResult7;
    state[4] = piResult4 ^ ~piResult6 & piResult8;
    state[5] = piResult5 ^ ~piResult7 & piResult9;
    state[6] = piResult6 ^ ~piResult8 & piResult0;
    state[7] = piResult7 ^ ~piResult9 & piResult1;
    state[8] = piResult8 ^ ~piResult0 & piResult2;
    state[9] = piResult9 ^ ~piResult1 & piResult3;
    state[10] = piResult10 ^ ~piResult12 & piResult14;
    state[11] = piResult11 ^ ~piResult13 & piResult15;
    state[12] = piResult12 ^ ~piResult14 & piResult16;
    state[13] = piResult13 ^ ~piResult15 & piResult17;
    state[14] = piResult14 ^ ~piResult16 & piResult18;
    state[15] = piResult15 ^ ~piResult17 & piResult19;
    state[16] = piResult16 ^ ~piResult18 & piResult10;
    state[17] = piResult17 ^ ~piResult19 & piResult11;
    state[18] = piResult18 ^ ~piResult10 & piResult12;
    state[19] = piResult19 ^ ~piResult11 & piResult13;
    state[20] = piResult20 ^ ~piResult22 & piResult24;
    state[21] = piResult21 ^ ~piResult23 & piResult25;
    state[22] = piResult22 ^ ~piResult24 & piResult26;
    state[23] = piResult23 ^ ~piResult25 & piResult27;
    state[24] = piResult24 ^ ~piResult26 & piResult28;
    state[25] = piResult25 ^ ~piResult27 & piResult29;
    state[26] = piResult26 ^ ~piResult28 & piResult20;
    state[27] = piResult27 ^ ~piResult29 & piResult21;
    state[28] = piResult28 ^ ~piResult20 & piResult22;
    state[29] = piResult29 ^ ~piResult21 & piResult23;
    state[30] = piResult30 ^ ~piResult32 & piResult34;
    state[31] = piResult31 ^ ~piResult33 & piResult35;
    state[32] = piResult32 ^ ~piResult34 & piResult36;
    state[33] = piResult33 ^ ~piResult35 & piResult37;
    state[34] = piResult34 ^ ~piResult36 & piResult38;
    state[35] = piResult35 ^ ~piResult37 & piResult39;
    state[36] = piResult36 ^ ~piResult38 & piResult30;
    state[37] = piResult37 ^ ~piResult39 & piResult31;
    state[38] = piResult38 ^ ~piResult30 & piResult32;
    state[39] = piResult39 ^ ~piResult31 & piResult33;
    state[40] = piResult40 ^ ~piResult42 & piResult44;
    state[41] = piResult41 ^ ~piResult43 & piResult45;
    state[42] = piResult42 ^ ~piResult44 & piResult46;
    state[43] = piResult43 ^ ~piResult45 & piResult47;
    state[44] = piResult44 ^ ~piResult46 & piResult48;
    state[45] = piResult45 ^ ~piResult47 & piResult49;
    state[46] = piResult46 ^ ~piResult48 & piResult40;
    state[47] = piResult47 ^ ~piResult49 & piResult41;
    state[48] = piResult48 ^ ~piResult40 & piResult42;
    state[49] = piResult49 ^ ~piResult41 & piResult43;
    state[0] ^= IOTA_CONSTANTS[round * 2];
    state[1] ^= IOTA_CONSTANTS[round * 2 + 1];
  }
}
function divideToBlocks(bytes, paddingByte) {
  if (!bytes.length) {
    const padding = new Uint8Array(136);
    padding[0] = paddingByte;
    padding[135] = 128;
    return [bytesToNumbers(padding)];
  }
  const blocks = partition(bytes, 136);
  const lastBlock = blocks[blocks.length - 1];
  if (lastBlock.length < 136) {
    const padded = new Uint8Array(136);
    padded.set(lastBlock);
    padded[lastBlock.length] = paddingByte;
    padded[135] = padded[135] | 128;
    blocks[blocks.length - 1] = padded;
  }
  if (lastBlock.length === 136) {
    const padding = new Uint8Array(136);
    padding[0] = paddingByte;
    padding[135] = 128;
    blocks.push(padding);
  }
  return blocks.map(bytesToNumbers);
}
function bytesToNumbers(bytes) {
  const numbers = [];
  for (let i = 0; i < bytes.length; i += 4) {
    numbers.push(bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16 | bytes[i + 3] << 24);
  }
  return numbers;
}
function squeeze(state) {
  return new Uint8Array([
    state[1],
    state[1] >> -24,
    state[1] >> -16,
    state[1] >> -8,
    state[0],
    state[0] >> 8,
    state[0] >> 16,
    state[0] >> 24,
    state[3],
    state[3] >> -24,
    state[3] >> -16,
    state[3] >> -8,
    state[2],
    state[2] >> 8,
    state[2] >> 16,
    state[2] >> 24,
    state[5],
    state[5] >> -24,
    state[5] >> -16,
    state[5] >> -8,
    state[4],
    state[4] >> 8,
    state[4] >> 16,
    state[4] >> 24,
    state[7],
    state[7] >> -24,
    state[7] >> -16,
    state[7] >> -8,
    state[6],
    state[6] >> 8,
    state[6] >> 16,
    state[6] >> 24
  ]);
}

// src/bytes/bytes.ts
var DECODER = new TextDecoder();
var ENCODER = new TextEncoder();
var HEX_PATTERN = /^(0x)?[0-9a-fA-F]*$/i;
function hasToHexMethod(value) {
  return typeof value === "object" && value !== null && typeof value.toHex === "function";
}
var Bytes = class _Bytes {
  bytes;
  length;
  /**
   * @param byteLength If given, throws unless the resulting length matches
   * (or, for an array, is one of) the expected length(s).
   */
  constructor(bytes, byteLength) {
    if (!bytes) {
      throw new Error(`Bytes#constructor: constructor parameter is falsy: ${bytes}`);
    }
    if (bytes instanceof _Bytes) {
      this.bytes = bytes.bytes;
    } else if (typeof bytes === "string") {
      if (!HEX_PATTERN.test(bytes) || bytes.replace(/^0x/i, "").length % 2 !== 0) {
        throw new Error(`Bytes#constructor: invalid hex string: ${bytes}`);
      }
      this.bytes = hexToUint8Array(bytes);
    } else if (bytes instanceof ArrayBuffer) {
      this.bytes = new Uint8Array(bytes);
    } else if (bytes instanceof Uint8Array) {
      this.bytes = bytes;
    } else {
      const unknownInput = bytes;
      if (hasToHexMethod(unknownInput)) {
        this.bytes = hexToUint8Array(unknownInput.toHex());
      } else {
        throw new Error(`Bytes#constructor: unsupported type: ${typeof bytes}`);
      }
    }
    this.length = this.bytes.length;
    if (byteLength !== void 0) {
      if (Array.isArray(byteLength)) {
        if (!byteLength.includes(this.length)) {
          throw new Error(
            `Bytes#checkByteLength: bytes length is ${this.length} but expected ${byteLength.join(" or ")}`
          );
        }
      } else if (this.length !== byteLength) {
        throw new Error(`Bytes#checkByteLength: bytes length is ${this.length} but expected ${byteLength}`);
      }
    }
  }
  /**
   * Hashes `bytes` with keccak256 and wraps the 32-byte digest.
   */
  static keccak256(bytes) {
    return new _Bytes(keccak256(new _Bytes(bytes).toUint8Array()));
  }
  /**
   * Wraps the UTF-8 encoding of a string.
   */
  static fromUtf8(utf8) {
    return new _Bytes(ENCODER.encode(utf8));
  }
  /**
   * Wraps a slice of `bytes` starting at `start`, running to the end unless
   * `length` is given.
   */
  static fromSlice(bytes, start, length) {
    if (length === void 0) {
      return new _Bytes(bytes.slice(start));
    }
    return new _Bytes(bytes.slice(start, start + length));
  }
  /**
   * Returns a copy of the bytes from `index` to the end.
   */
  offset(index) {
    return new Uint8Array(this.bytes.slice(index));
  }
  /**
   * Returns a copy of the underlying bytes.
   */
  toUint8Array() {
    return new Uint8Array(this.bytes);
  }
  /**
   * Encodes as a lowercase hex string, with no `0x` prefix.
   */
  toHex() {
    return uint8ArrayToHex(this.bytes);
  }
  /**
   * Encodes as a padded base64 string.
   */
  toBase64() {
    return uint8ArrayToBase64(this.bytes);
  }
  /**
   * Encodes as a padded base32 string.
   */
  toBase32() {
    return uint8ArrayToBase32(this.bytes);
  }
  /**
   * Same as {@link toHex}.
   */
  toString() {
    return this.toHex();
  }
  /**
   * Decodes the bytes as UTF-8 text.
   */
  toUtf8() {
    return DECODER.decode(this.bytes);
  }
  /**
   * Decodes the bytes as UTF-8 JSON.
   */
  toJSON() {
    return JSON.parse(this.toUtf8());
  }
  /**
   * Byte-wise equality against another Bytes instance, raw bytes, or hex string.
   */
  equals(other) {
    return this.toHex() === new _Bytes(other).toHex();
  }
  /**
   * Human-readable representation, used by debuggers/loggers. Same as {@link toHex}.
   */
  represent() {
    return this.toHex();
  }
};

// src/bytes/reference.ts
var SWARM_MANIFEST_CODEC = 250;
var SWARM_FEED_CODEC = 251;
function decodeCid(cid) {
  const bytes = base32ToUint8Array(cid.toUpperCase().slice(1));
  const codec = bytes[1];
  if (codec !== SWARM_MANIFEST_CODEC && codec !== SWARM_FEED_CODEC) {
    throw new Error("Unknown codec");
  }
  return bytes.slice(-32);
}
var Reference = class _Reference extends Bytes {
  static LENGTH = 32;
  constructor(bytes) {
    if (typeof bytes === "string" && bytes.startsWith("bah5")) {
      super(decodeCid(bytes), 32);
    } else {
      super(bytes, [32, 64]);
    }
  }
  /**
   * Encodes the reference as a `"bah5..."` CID string of the given type.
   */
  toCid(type) {
    const header = concatBytes(
      new Uint8Array([1]),
      // version
      new Uint8Array([type === "feed" ? SWARM_FEED_CODEC : SWARM_MANIFEST_CODEC]),
      new Uint8Array([1]),
      // "unknown" multihash
      new Uint8Array([27]),
      // sha256
      new Uint8Array([32])
      // 32-byte digest length
    );
    return `b${uint8ArrayToBase32(header).replace(/=+$/, "")}${this.toBase32().replace(/=+$/, "")}`.toLowerCase();
  }
  /**
   * Returns whether `value` parses as a valid Reference (raw hex, 32/64-byte
   * bytes, or a `"bah5..."` CID string).
   */
  static isValid(value) {
    try {
      new _Reference(value);
      return true;
    } catch {
      return false;
    }
  }
};

// src/chunk/byte-cursor.ts
var Uint8ArrayReader = class {
  cursor = 0;
  buffer;
  constructor(buffer) {
    this.buffer = buffer;
  }
  /**
   * Reads (a view into) the next `size` bytes and advances the cursor.
   */
  read(size) {
    const data = this.buffer.subarray(this.cursor, this.cursor + size);
    this.cursor += size;
    return data;
  }
  /**
   * Returns the number of unread bytes remaining.
   */
  max() {
    return this.buffer.length - this.cursor;
  }
};
var Uint8ArrayWriter = class {
  cursor = 0;
  buffer;
  constructor(buffer) {
    this.buffer = buffer;
  }
  /**
   * Copies as many bytes as fit from `reader` into the buffer at the
   * current cursor, advancing both. Returns the number of bytes written.
   */
  write(reader) {
    const max = Math.min(this.max(), reader.max());
    this.buffer.set(reader.read(max), this.cursor);
    this.cursor += max;
    return max;
  }
  /**
   * Returns the number of unwritten bytes remaining.
   */
  max() {
    return this.buffer.length - this.cursor;
  }
};

// src/encryption/stream-cipher.ts
var SPAN_ENCRYPT_INIT_CTR = 128;
function encryptSegments(key, initCtr, data) {
  const out = new Uint8Array(data.length);
  const buf = new Uint8Array(36);
  buf.set(key);
  for (let i = 0, offset = 0; offset < data.length; i++, offset += 32) {
    const ctr = initCtr + i >>> 0;
    buf[32] = ctr & 255;
    buf[33] = ctr >>> 8 & 255;
    buf[34] = ctr >>> 16 & 255;
    buf[35] = ctr >>> 24 & 255;
    const segKey = keccak256(keccak256(buf));
    const end = Math.min(offset + 32, data.length);
    for (let j = offset; j < end; j++) {
      out[j] = data[j] ^ segKey[j - offset];
    }
  }
  return out;
}
function encryptSpan(key, spanBytes) {
  return encryptSegments(key, SPAN_ENCRYPT_INIT_CTR, spanBytes);
}
function encryptData(key, data) {
  return encryptSegments(key, 0, data);
}

// src/chunk/bmt.ts
var MAX_CHUNK_PAYLOAD_SIZE = 4096;
var SEGMENT_SIZE = 32;
var SPAN_LENGTH = 8;
function calculateChunkAddress(chunkContent) {
  const span = chunkContent.subarray(0, SPAN_LENGTH);
  const payload = chunkContent.subarray(SPAN_LENGTH);
  const rootHash = calculateBmtRootHash(payload);
  return new Reference(keccak256(concatBytes(span, rootHash)));
}
function calculateBmtRootHash(payload) {
  if (payload.length > MAX_CHUNK_PAYLOAD_SIZE) {
    throw new Error(`payload size ${payload.length} exceeds maximum chunk payload size ${MAX_CHUNK_PAYLOAD_SIZE}`);
  }
  const input = new Uint8Array(MAX_CHUNK_PAYLOAD_SIZE);
  input.set(payload);
  let segments = partition(input, SEGMENT_SIZE);
  while (segments.length > 1) {
    const next = [];
    for (let i = 0; i < segments.length; i += 2) {
      next.push(keccak256(concatBytes(segments[i], segments[i + 1])));
    }
    segments = next;
  }
  return segments[0];
}

// src/chunk/splitter.ts
var ChunkBuilder = class {
  span;
  writer;
  constructor(span = 0n) {
    this.span = span;
    this.writer = new Uint8ArrayWriter(new Uint8Array(4096));
  }
  /**
   * Returns the raw chunk bytes: 8-byte span || 4096-byte payload buffer.
   */
  build() {
    return concatBytes(numberToUint64(this.span, "LE"), this.writer.buffer);
  }
  /**
   * Computes the unencrypted BMT address of this chunk.
   */
  hash() {
    return calculateChunkAddress(this.build());
  }
  /**
   * Encrypts this chunk with `key` (generating a random one if omitted) and
   * returns the resulting address alongside the key used.
   */
  encryptedHash(key) {
    if (!key) {
      key = new Uint8Array(32);
      crypto.getRandomValues(key);
    }
    const encSpan = encryptSpan(key, numberToUint64(this.span, "LE"));
    const encPayload = encryptData(key, this.writer.buffer);
    return { address: calculateChunkAddress(concatBytes(encSpan, encPayload)), key };
  }
};
var ChunkSplitter = class _ChunkSplitter {
  static NOOP = async (_) => [];
  refSize;
  encrypted;
  maxShards;
  chunks;
  counters = [1];
  pending = [[]];
  onBatch;
  onIntermediateChunk;
  hasParity = [false];
  pendingEntries = [];
  /**
   * @param onBatch Called with each level's sealed chunks as a batch fills
   * up; return any parity entries to append as extra references (empty
   * array for no redundancy).
   * @param maxShards Max data-chunk references per intermediate node.
   * Defaults to as many as fit in one 4096-byte node; pass a smaller value
   * (e.g. via erasure-coding's getMaxShards) to leave room for parity refs.
   * @param onIntermediateChunk Called with each intermediate chunk as it's
   * sealed, so callers can tag it (e.g. encoding a redundancy level into its span).
   */
  constructor(onBatch, maxShards, encrypted = false, onIntermediateChunk) {
    this.encrypted = encrypted;
    this.refSize = encrypted ? 64 : 32;
    this.maxShards = maxShards ?? 4096 / this.refSize;
    this.chunks = [new ChunkBuilder()];
    this.onBatch = onBatch;
    this.onIntermediateChunk = onIntermediateChunk;
  }
  /**
   * Splits `data` into a chunk tree (no redundancy, no encryption, no
   * upload callback) and returns just its root chunk.
   */
  static async root(data) {
    const tree = new _ChunkSplitter(_ChunkSplitter.NOOP);
    await tree.append(data);
    return tree.finalize();
  }
  /**
   * Splits `data` into an encrypted chunk tree (no upload callback) and
   * returns the root's encrypted address and key.
   */
  static async encryptedRoot(data) {
    const tree = new _ChunkSplitter(_ChunkSplitter.NOOP, void 0, true);
    await tree.append(data);
    const root = await tree.finalize();
    return root.encryptedHash();
  }
  /**
   * Appends more data to the tree, sealing and elevating chunks as needed.
   * `level`/`spanIncrement` are internal - callers building a tree from raw
   * input data should always call this at the default level 0.
   */
  async append(data, level = 0, spanIncrement = 0n) {
    const reader = new Uint8ArrayReader(data);
    while (reader.max() > 0) {
      if (this.chunks[level].writer.max() === 0 || spanIncrement && this.chunks[level].writer.max() < data.length) {
        await this.elevate(level);
      }
      const written = this.chunks[level].writer.write(reader);
      if (spanIncrement) {
        this.chunks[level].span += spanIncrement;
      } else {
        this.chunks[0].span += BigInt(written);
      }
    }
  }
  async elevate(level) {
    this.counters[level] = (this.counters[level] + 1) % (4096 / this.refSize);
    if (!this.pending[level]) this.pending[level] = [];
    await this.sealParities(level);
    const originalSpan = this.chunks[level].span;
    if (level >= 1 && this.onIntermediateChunk) {
      this.onIntermediateChunk(this.chunks[level], this.hasParity[level] ?? false);
      this.hasParity[level] = false;
    }
    if (this.encrypted) {
      const { address, key } = this.chunks[level].encryptedHash();
      const ref = new Uint8Array(64);
      ref.set(address.toUint8Array());
      ref.set(key, 32);
      this.pending[level].push({ entry: { chunk: this.chunks[level], key }, ref, span: originalSpan });
    } else {
      this.pending[level].push({
        entry: { chunk: this.chunks[level] },
        ref: this.chunks[level].hash().toUint8Array(),
        span: originalSpan
      });
    }
    this.chunks[level] = new ChunkBuilder();
    if (this.pending[level].length >= this.maxShards) {
      await this.flushBatch(level);
    }
  }
  async sealParities(level) {
    const entries = this.pendingEntries[level];
    if (!entries?.length) return;
    this.pendingEntries[level] = [];
    const parities = await this.onBatch(entries);
    if (parities.length > 0) {
      this.hasParity[level] = true;
      for (const { chunk } of parities) {
        this.chunks[level].writer.write(new Uint8ArrayReader(chunk.hash().toUint8Array()));
      }
    }
  }
  async flushBatch(level) {
    if (!this.chunks[level + 1]) {
      this.chunks.push(new ChunkBuilder());
      this.counters.push(1);
      this.pending.push([]);
      this.hasParity.push(false);
    }
    const batch = this.pending[level];
    this.pending[level] = [];
    for (const { ref, span } of batch) {
      await this.append(ref, level + 1, span);
    }
    if (!this.pendingEntries[level + 1]) this.pendingEntries[level + 1] = [];
    this.pendingEntries[level + 1].push(...batch.map((p) => p.entry));
    if (batch.length >= this.maxShards) await this.sealParities(level + 1);
  }
  /**
   * Seals every level and returns the tree's root chunk. `level` is
   * internal - callers should always start at the default level 0.
   */
  async finalize(level = 0) {
    if (this.pending[level]?.length) {
      await this.flushBatch(level);
    }
    if (!this.chunks[level + 1]) {
      await this.sealParities(level);
      if (level >= 1 && this.onIntermediateChunk) {
        this.onIntermediateChunk(this.chunks[level], this.hasParity[level] ?? false);
      }
      return this.chunks[level];
    }
    if (this.counters[level] === 1) {
      await this.elevate(level + 1);
      await this.flushBatch(level + 1);
      this.chunks[level + 1] = this.chunks[level];
      return this.finalize(level + 1);
    }
    await this.elevate(level);
    await this.flushBatch(level);
    return this.finalize(level + 1);
  }
};

// src/encryption/xor-cipher.ts
function xorCypher(bytes, key) {
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ key[i % key.length];
  }
  return result;
}

// src/mantaray/node.ts
var ENCODER2 = new TextEncoder();
var DECODER2 = new TextDecoder();
var TYPE_VALUE = 2;
var TYPE_EDGE = 4;
var TYPE_WITH_PATH_SEPARATOR = 8;
var TYPE_WITH_METADATA = 16;
var PATH_SEPARATOR = new Uint8Array([47]);
var VERSION_02_HASH = hexToUint8Array("5768b3b6a7db56d21d1abff40d41cebfc83448fed8d7e9b06ec0d3b073f28f7b");
function setBit(bytes, index) {
  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;
  bytes[byteIndex] = bytes[byteIndex] | 1 << bitIndex;
}
function getBit(bytes, index) {
  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;
  return (bytes[byteIndex] >> bitIndex & 1) === 1;
}
var MantarayNode = class _MantarayNode {
  obfuscationKey = new Uint8Array(32);
  selfAddress = null;
  targetAddress = new Uint8Array(32);
  metadata = null;
  path = new Uint8Array(0);
  forks = /* @__PURE__ */ new Map();
  parent = null;
  type = null;
  encrypt = false;
  constructor(options) {
    if (options?.encrypt) {
      this.encrypt = true;
    }
    if (options?.targetAddress) {
      this.targetAddress = options.targetAddress;
    } else if (this.encrypt) {
      this.targetAddress = new Uint8Array(64);
    }
    if (options?.selfAddress) {
      this.selfAddress = options.selfAddress;
    }
    if (options?.metadata) {
      this.metadata = options.metadata;
    }
    if (options?.obfuscationKey) {
      this.obfuscationKey = options.obfuscationKey;
    }
    if (options?.path) {
      this.path = options.path;
    }
    if (options?.parent) {
      this.parent = options.parent;
    }
    this.type = options?.type ?? null;
  }
  /**
   * The full path from the tree's root to this node, concatenating every
   * ancestor's own path segment.
   */
  get fullPath() {
    return concatBytes(this.parent?.fullPath ?? new Uint8Array(0), this.path);
  }
  /**
   * {@link fullPath} decoded as UTF-8.
   */
  get fullPathString() {
    return DECODER2.decode(this.fullPath);
  }
  /**
   * Gets the binary representation of the node.
   */
  async marshal() {
    for (const fork of this.forks.values()) {
      if (!fork.node.selfAddress) {
        fork.node.selfAddress = (await fork.node.calculateSelfAddress()).toUint8Array();
      }
    }
    if (this.encrypt && equals(this.obfuscationKey, new Uint8Array(32))) {
      this.obfuscationKey = new Uint8Array(32);
      crypto.getRandomValues(this.obfuscationKey);
    }
    const hasEntry = !equals(this.targetAddress, new Uint8Array(this.targetAddress.length));
    let refBytesSize = 0;
    if (hasEntry) {
      refBytesSize = this.targetAddress.length;
    } else {
      for (const fork of this.forks.values()) {
        if (fork.node.selfAddress && fork.node.selfAddress.length > 0) {
          refBytesSize = fork.node.selfAddress.length;
          break;
        }
      }
    }
    const header = new Uint8Array(32);
    header.set(VERSION_02_HASH, 0);
    header.set(numberToUint8(refBytesSize), 31);
    const entry = hasEntry ? this.targetAddress : new Uint8Array(refBytesSize);
    const forkBitmap = new Uint8Array(32);
    for (const fork of this.forks.keys()) {
      setBit(forkBitmap, fork);
    }
    const forks = [];
    for (let i = 0; i < 256; i++) {
      if (getBit(forkBitmap, i)) {
        forks.push(this.forks.get(i).marshal());
      }
    }
    const data = xorCypher(concatBytes(header, entry, forkBitmap, ...forks), this.obfuscationKey);
    return concatBytes(this.obfuscationKey, data);
  }
  /**
   * Unmarshals a MantarayNode from previously marshaled data. Each fork's
   * child node only carries its own `selfAddress` - fetch and unmarshal it
   * (e.g. via `saveRecursively`'s chunk store) to descend further.
   */
  static unmarshalFromData(data, selfAddress) {
    if (data.length < 64) {
      throw new Error("MantarayNode#unmarshalFromData data too short");
    }
    const obfuscationKey = data.subarray(0, 32);
    const decrypted = xorCypher(data.subarray(32), obfuscationKey);
    const reader = new Uint8ArrayReader(decrypted);
    const versionHash = reader.read(31);
    if (!equals(versionHash, VERSION_02_HASH.slice(0, 31))) {
      throw new Error("MantarayNode#unmarshalFromData invalid version hash");
    }
    const refBytesSize = uint8ToNumber(reader.read(1));
    const targetAddress = reader.read(refBytesSize);
    const node = new _MantarayNode({ selfAddress, targetAddress, obfuscationKey });
    const forkBitmap = reader.read(32);
    const forkRefSize = refBytesSize === 0 ? 32 : refBytesSize;
    for (let i = 0; i < 256; i++) {
      if (getBit(forkBitmap, i)) {
        const fork = Fork.unmarshal(reader, forkRefSize);
        node.forks.set(i, fork);
        fork.node.parent = node;
      }
    }
    return node;
  }
  /**
   * Adds a fork to the node.
   */
  addFork(path, reference, metadata) {
    this.selfAddress = null;
    this.type = null;
    path = path instanceof Uint8Array ? path : ENCODER2.encode(path);
    let tip = this;
    while (path.length) {
      const prefix = path.slice(0, 30);
      path = path.slice(30);
      const isLast = path.length === 0;
      const [bestMatch, matchedPath] = tip.findClosest(prefix);
      const remainingPath = prefix.slice(matchedPath.length);
      if (matchedPath.length) {
        tip = bestMatch;
      }
      if (!remainingPath.length) {
        continue;
      }
      const newFork = new Fork(
        remainingPath,
        new _MantarayNode({
          targetAddress: isLast ? new Reference(reference).toUint8Array() : void 0,
          metadata: isLast ? metadata : void 0,
          path: remainingPath,
          encrypt: this.encrypt
        })
      );
      const existing = bestMatch.forks.get(remainingPath[0]);
      if (existing) {
        const fork = Fork.split(newFork, existing);
        tip.forks.set(remainingPath[0], fork);
        fork.node.parent = tip;
      } else {
        tip.forks.set(remainingPath[0], newFork);
        newFork.node.parent = tip;
      }
      tip.selfAddress = null;
      tip.type = null;
      tip = newFork.node;
    }
  }
  /**
   * Removes a fork from the node.
   */
  removeFork(path) {
    this.selfAddress = null;
    this.type = null;
    path = path instanceof Uint8Array ? path : ENCODER2.encode(path);
    if (path.length === 0) {
      throw new Error("MantarayNode#removeFork path cannot be empty");
    }
    const match = this.find(path);
    if (!match) {
      throw new Error("MantarayNode#removeFork fork not found");
    }
    const [parent, matchedPath] = this.findClosest(path.slice(0, path.length - 1));
    parent.forks.delete(path.slice(matchedPath.length)[0]);
    for (const fork of match.forks.values()) {
      parent.addFork(concatBytes(match.path, fork.prefix), fork.node.targetAddress, fork.node.metadata);
    }
  }
  /**
   * Calculates the self address of the node.
   */
  async calculateSelfAddress() {
    if (this.selfAddress) {
      return new Reference(this.selfAddress);
    }
    if (this.encrypt) {
      throw new Error("MantarayNode#calculateSelfAddress is not supported for encrypted nodes - use saveRecursively");
    }
    return (await ChunkSplitter.root(await this.marshal())).hash();
  }
  /**
   * Saves the node and its children recursively via the given `onChunk`
   * callback - no network client involved, the caller decides how and where
   * chunks get persisted.
   *
   * Returns the reference to the saved manifest (32 bytes, or 64 bytes -
   * address || key - for an encrypted manifest) and the root chunk, so
   * callers can also create dispersed replicas from it.
   */
  async saveRecursively(onChunk) {
    for (const fork of this.forks.values()) {
      await fork.node.saveRecursively(onChunk);
    }
    const onBatch = async (batch) => {
      for (const { chunk, key } of batch) {
        await onChunk(chunk, key);
      }
      return [];
    };
    const splitter = new ChunkSplitter(onBatch, void 0, this.encrypt);
    await splitter.append(await this.marshal());
    const rootChunk = await splitter.finalize();
    if (this.encrypt) {
      const { address, key } = rootChunk.encryptedHash();
      await onChunk(rootChunk, key);
      this.selfAddress = concatBytes(address.toUint8Array(), key);
      return { reference: this.selfAddress, rootChunk, encryptionKey: key };
    }
    await onChunk(rootChunk);
    this.selfAddress = rootChunk.hash().toUint8Array();
    return { reference: this.selfAddress, rootChunk };
  }
  /**
   * Finds a node in the tree by its path.
   */
  find(path) {
    const target = path instanceof Uint8Array ? path : ENCODER2.encode(path);
    const [closest, matched] = this.findClosest(target);
    return matched.length === target.length ? closest : null;
  }
  /**
   * Finds the closest node in the tree to the given path.
   */
  findClosest(path, current = new Uint8Array()) {
    path = path instanceof Uint8Array ? path : ENCODER2.encode(path);
    if (path.length === 0) {
      return [this, current];
    }
    const fork = this.forks.get(path[0]);
    if (fork && commonPrefix(fork.prefix, path).length === fork.prefix.length) {
      return fork.node.findClosest(path.slice(fork.prefix.length), concatBytes(current, fork.prefix));
    }
    return [this, current];
  }
  /**
   * Returns every node in the tree that has a target address set.
   */
  collect(nodes = []) {
    for (const fork of this.forks.values()) {
      if (!equals(fork.node.targetAddress, new Uint8Array(fork.node.targetAddress.length))) {
        nodes.push(fork.node);
      }
      fork.node.collect(nodes);
    }
    return nodes;
  }
  /**
   * Returns a path -> reference (hex) map of every node in the tree that has
   * a target address set.
   */
  collectAndMap() {
    const result = {};
    for (const node of this.collect()) {
      result[node.fullPathString] = new Reference(node.targetAddress).toHex();
    }
    return result;
  }
  /**
   * Computes this node's type byte (value/edge/path-separator/metadata
   * flags) from its current in-memory state.
   */
  determineType() {
    let type = 0;
    const nullAddress = new Uint8Array(this.targetAddress.length);
    if (!equals(this.targetAddress, nullAddress) || this.forks.size === 0) {
      type |= TYPE_VALUE;
    }
    if (this.forks.size > 0) {
      type |= TYPE_EDGE;
    }
    if (indexOf(this.path, PATH_SEPARATOR) > 0) {
      type |= TYPE_WITH_PATH_SEPARATOR;
    }
    if (this.metadata) {
      type |= TYPE_WITH_METADATA;
    }
    return type;
  }
};

// src/mantaray/fork.ts
var TYPE_WITH_METADATA2 = 16;
var ENCODER3 = new TextEncoder();
var DECODER3 = new TextDecoder();
function isType(value, type) {
  return (value & type) === type;
}
function padEndToMultiple(bytes, multiple, paddingByte) {
  const remainder = bytes.length % multiple;
  if (remainder === 0) {
    return bytes;
  }
  const result = new Uint8Array(bytes.length + multiple - remainder).fill(paddingByte);
  result.set(bytes, 0);
  return result;
}
var Fork = class _Fork {
  prefix;
  node;
  constructor(prefix, node) {
    this.prefix = prefix;
    this.node = node;
  }
  /**
   * Merges two forks that share a path prefix, splitting off a new
   * intermediate node at the point where their prefixes diverge.
   */
  static split(a, b) {
    const commonPart = commonPrefix(a.prefix, b.prefix);
    if (commonPart.length === a.prefix.length) {
      const remainingB = b.prefix.slice(commonPart.length);
      b.node.path = b.prefix.slice(commonPart.length);
      b.prefix = b.prefix.slice(commonPart.length);
      b.node.parent = a.node;
      a.node.forks.set(remainingB[0], b);
      return a;
    }
    if (commonPart.length === b.prefix.length) {
      const remainingA = a.prefix.slice(commonPart.length);
      a.node.path = a.prefix.slice(commonPart.length);
      a.prefix = a.prefix.slice(commonPart.length);
      a.node.parent = b.node;
      b.node.forks.set(remainingA[0], a);
      return b;
    }
    const node = new MantarayNode({ path: commonPart, encrypt: a.node.encrypt });
    const newAFork = new _Fork(a.prefix.slice(commonPart.length), a.node);
    const newBFork = new _Fork(b.prefix.slice(commonPart.length), b.node);
    a.node.path = a.prefix.slice(commonPart.length);
    b.node.path = b.prefix.slice(commonPart.length);
    a.prefix = a.prefix.slice(commonPart.length);
    b.prefix = b.prefix.slice(commonPart.length);
    node.forks.set(newAFork.prefix[0], newAFork);
    node.forks.set(newBFork.prefix[0], newBFork);
    newAFork.node.parent = node;
    newBFork.node.parent = node;
    return new _Fork(commonPart, node);
  }
  /**
   * Gets the binary representation of the fork (type byte, prefix, self
   * address, and optional metadata).
   */
  marshal() {
    if (!this.node.selfAddress) {
      throw new Error("Fork#marshal node.selfAddress is not set");
    }
    const data = [];
    data.push(new Uint8Array([this.node.type ?? this.node.determineType()]));
    data.push(numberToUint8(this.prefix.length));
    data.push(this.prefix);
    if (this.prefix.length < 30) {
      data.push(new Uint8Array(30 - this.prefix.length));
    }
    data.push(this.node.selfAddress);
    if (this.node.metadata) {
      const metadataBytes = padEndToMultiple(
        concatBytes(new Uint8Array([0, 0]), ENCODER3.encode(JSON.stringify(this.node.metadata))),
        32,
        10
      );
      metadataBytes.set(numberToUint16(metadataBytes.length - 2, "BE"), 0);
      data.push(metadataBytes);
    }
    return concatBytes(...data);
  }
  /**
   * Reads a single fork (and its node's selfAddress/metadata) out of a
   * reader positioned at the start of the fork's bytes.
   */
  static unmarshal(reader, addressLength) {
    const type = uint8ToNumber(reader.read(1));
    const prefixLength = uint8ToNumber(reader.read(1));
    const prefix = reader.read(prefixLength);
    if (prefixLength < 30) {
      reader.read(30 - prefixLength);
    }
    const selfAddress = reader.read(addressLength);
    let metadata = void 0;
    if (isType(type, TYPE_WITH_METADATA2)) {
      const metadataLength = uint16ToNumber(reader.read(2), "BE");
      if (metadataLength > reader.max()) {
        throw new Error("Fork#unmarshal not enough bytes for metadata");
      }
      metadata = JSON.parse(DECODER3.decode(reader.read(metadataLength)));
    }
    return new _Fork(prefix, new MantarayNode({ selfAddress, metadata, path: prefix, type }));
  }
};
export {
  Fork,
  MantarayNode
};
//# sourceMappingURL=index.js.map
