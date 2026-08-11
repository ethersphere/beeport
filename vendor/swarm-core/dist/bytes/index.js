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
function numberToUint256(value, endian) {
  const bytes = new Uint8Array(32);
  let remaining = value;
  if (endian === "LE") {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
    return bytes;
  }
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}
function uint256ToNumber(bytes, endian) {
  let result = 0n;
  if (endian === "LE") {
    for (let i = 31; i >= 0; i--) {
      result = result << 8n | BigInt(bytes[i]);
    }
    return result;
  }
  for (let i = 0; i < 32; i++) {
    result = result << 8n | BigInt(bytes[i]);
  }
  return result;
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
function base64ToUint8Array(base64) {
  return baseToUint8Array(base64, BASE64_CHARS);
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
function uint8ArrayToBinary(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(2).padStart(8, "0")).join("");
}
function binaryToUint8Array(binary) {
  const result = new Uint8Array(Math.ceil(binary.length / 8));
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(binary.slice(i * 8, i * 8 + 8), 2);
  }
  return result;
}
function sliceBytes(bytes, lengths) {
  const result = [];
  let offset = 0;
  for (const length of lengths) {
    result.push(bytes.subarray(offset, offset + length));
    offset += length;
  }
  return result;
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
function numberToUint32(value, endian) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, endian === "LE");
  return new Uint8Array(buffer);
}
function uint32ToNumber(bytes, endian) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, endian === "LE");
}
function numberToUint64(value, endian) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, value, endian === "LE");
  return new Uint8Array(buffer);
}
function uint64ToNumber(bytes, endian) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(0, endian === "LE");
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

// src/bytes/batch-id.ts
var BatchId = class extends Bytes {
  static LENGTH = 32;
  constructor(bytes) {
    super(bytes, 32);
  }
};

// src/crypto/keys.ts
import { secp256k1 } from "@noble/curves/secp256k1.js";
var SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
function privateKeyToPublicKey(privateKey) {
  if (privateKey <= 0n || privateKey >= SECP256K1_N) {
    throw new Error("Invalid private key");
  }
  const point = secp256k1.Point.BASE.multiply(privateKey);
  return [point.x, point.y];
}
function compressPublicKey(publicKey) {
  return secp256k1.Point.fromAffine({ x: publicKey[0], y: publicKey[1] }).toBytes(true);
}
function publicKeyFromCompressed(compressed) {
  if (compressed.length !== 33 || compressed[0] !== 2 && compressed[0] !== 3) {
    throw new Error("Invalid compressed public key");
  }
  const point = secp256k1.Point.fromBytes(compressed);
  return [point.x, point.y];
}
function publicKeyToAddress(publicKey) {
  const address = new Uint8Array(20);
  const hash = keccak256(concatBytes(numberToUint256(publicKey[0], "BE"), numberToUint256(publicKey[1], "BE")));
  address.set(hash.subarray(12));
  return address;
}
function checksumEncode(addressBytes) {
  const address = uint8ArrayToHex(addressBytes);
  const addressAscii = Uint8Array.from(address, (char) => char.charCodeAt(0));
  const hash = uint8ArrayToHex(keccak256(addressAscii));
  let result = "0x";
  for (let i = 0; i < address.length; i++) {
    result += parseInt(hash.charAt(i), 16) > 7 ? address.charAt(i).toUpperCase() : address.charAt(i);
  }
  return result;
}

// src/bytes/eth-address.ts
var EthAddress = class extends Bytes {
  static LENGTH = 20;
  constructor(bytes) {
    super(bytes, 20);
  }
  /**
   * EIP-55 checksum-cased hex representation (e.g. `0x5aAe...`).
   */
  toChecksum() {
    return checksumEncode(this.bytes);
  }
};

// src/bytes/feed-index.ts
var MAX_UINT64 = new Uint8Array(8).fill(255, 0, 8);
var FeedIndex = class _FeedIndex extends Bytes {
  static LENGTH = 8;
  /** Sentinel index (all bits set) some feed types use to mean "no update yet". */
  static MINUS_ONE = new _FeedIndex(MAX_UINT64);
  constructor(bytes) {
    super(bytes, 8);
  }
  /**
   * Encodes a bigint index as an 8-byte, big-endian FeedIndex.
   */
  static fromBigInt(value) {
    return new _FeedIndex(numberToUint64(value, "BE"));
  }
  /**
   * Decodes the index as a bigint.
   */
  toBigInt() {
    return uint64ToNumber(this.bytes, "BE");
  }
  /**
   * Returns the next sequential index, wrapping {@link MINUS_ONE} back to 0.
   */
  next() {
    if (uint8ArrayToHex(this.bytes) === uint8ArrayToHex(MAX_UINT64)) {
      return _FeedIndex.fromBigInt(0n);
    }
    return _FeedIndex.fromBigInt(this.toBigInt() + 1n);
  }
};

// src/bytes/identifier.ts
var ENCODER2 = new TextEncoder();
var Identifier = class _Identifier extends Bytes {
  static LENGTH = 32;
  constructor(bytes) {
    super(bytes, 32);
  }
  /**
   * Derives an identifier by hashing an arbitrary string with keccak256.
   */
  static fromString(value) {
    return new _Identifier(keccak256(ENCODER2.encode(value)));
  }
};

// src/bytes/peer-address.ts
var PeerAddress = class extends Bytes {
  static LENGTH = 32;
  constructor(bytes) {
    super(bytes, 32);
  }
};

// src/crypto/ecdsa.ts
import { secp256k1 as secp256k12 } from "@noble/curves/secp256k1.js";
function signMessage(message, privateKey) {
  const signature = secp256k12.sign(keccak256(message), privateKey, { prehash: false });
  const v = signature.recovery === 0 ? 27n : 28n;
  return [signature.r, signature.s, v];
}
function recoverPublicKey(message, r, s, v) {
  const recovery = v === 27n ? 0 : 1;
  const signature = new secp256k12.Signature(r, s, recovery);
  const point = signature.recoverPublicKey(keccak256(message));
  return [point.x, point.y];
}

// src/bytes/public-key.ts
var PublicKey = class extends Bytes {
  static LENGTH = 64;
  constructor(bytes) {
    const uncompressed = new Bytes(bytes);
    if (uncompressed.length === 33) {
      const [x, y] = publicKeyFromCompressed(uncompressed.toUint8Array());
      super(concatBytes(numberToUint256(x, "BE"), numberToUint256(y, "BE")), 64);
    } else {
      super(bytes, 64);
    }
  }
  /**
   * Derives the corresponding Ethereum address (keccak256 of the
   * uncompressed key, last 20 bytes).
   */
  address() {
    const x = uint256ToNumber(this.bytes.slice(0, 32), "BE");
    const y = uint256ToNumber(this.bytes.slice(32, 64), "BE");
    return new EthAddress(publicKeyToAddress([x, y]));
  }
  /**
   * Encodes as a 33-byte compressed key (0x02/0x03 prefix || x).
   */
  toCompressedUint8Array() {
    const x = uint256ToNumber(this.bytes.slice(0, 32), "BE");
    const y = uint256ToNumber(this.bytes.slice(32, 64), "BE");
    return compressPublicKey([x, y]);
  }
  /**
   * Hex encoding of {@link toCompressedUint8Array}.
   */
  toCompressedHex() {
    return uint8ArrayToHex(this.toCompressedUint8Array());
  }
};

// src/bytes/signature.ts
var ENCODER3 = new TextEncoder();
var ETHEREUM_SIGNED_MESSAGE_PREFIX = ENCODER3.encode("Ethereum Signed Message:\n32");
function personalSignDigest(data) {
  const bytes = data instanceof Uint8Array ? data : ENCODER3.encode(data);
  return concatBytes(ETHEREUM_SIGNED_MESSAGE_PREFIX, keccak256(bytes));
}
var Signature = class _Signature extends Bytes {
  static LENGTH = 65;
  constructor(bytes) {
    super(bytes, 65);
  }
  /**
   * Reads a 65-byte Signature out of a larger buffer, starting at `start`.
   */
  static fromSlice(bytes, start) {
    return new _Signature(bytes.slice(start, start + _Signature.LENGTH));
  }
  /**
   * Recovers the public key that produced this signature over `digest`,
   * following the same personal_sign convention as {@link PrivateKey.sign}.
   */
  recoverPublicKey(digest) {
    const r = uint256ToNumber(this.bytes.slice(0, 32), "BE");
    const s = uint256ToNumber(this.bytes.slice(32, 64), "BE");
    const v = BigInt(this.bytes[64]);
    const [x, y] = recoverPublicKey(personalSignDigest(digest), r, s, v);
    return new PublicKey(concatBytes(numberToUint256(x, "BE"), numberToUint256(y, "BE")));
  }
  /**
   * Returns whether this signature over `digest` was produced by the owner
   * of `expectedAddress`.
   */
  isValid(digest, expectedAddress) {
    const publicKey = this.recoverPublicKey(digest);
    const address = publicKey.address();
    return address.equals(expectedAddress);
  }
};

// src/bytes/private-key.ts
var PrivateKey = class extends Bytes {
  static LENGTH = 32;
  constructor(bytes) {
    super(bytes, 32);
  }
  /**
   * Derives the corresponding (uncompressed) public key.
   */
  publicKey() {
    const [x, y] = privateKeyToPublicKey(this.toBigInt());
    return new PublicKey(concatBytes(numberToUint256(x, "BE"), numberToUint256(y, "BE")));
  }
  /**
   * Signs `data` following Ethereum's personal_sign convention (signs
   * keccak256("\x19Ethereum Signed Message:\n32" || keccak256(data))).
   */
  sign(data) {
    const [r, s, v] = signMessage(personalSignDigest(data), this.toBigInt());
    return new Signature(concatBytes(numberToUint256(r, "BE"), numberToUint256(s, "BE"), new Uint8Array([Number(v)])));
  }
  /**
   * Decodes the private key as a bigint scalar, for use in ECDSA operations.
   */
  toBigInt() {
    return uint256ToNumber(this.bytes, "BE");
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

// src/bytes/span.ts
var Span = class _Span extends Bytes {
  static LENGTH = 8;
  constructor(bytes) {
    super(bytes, 8);
  }
  /**
   * Encodes a bigint byte count as an 8-byte, little-endian Span.
   */
  static fromBigInt(value) {
    return new _Span(numberToUint64(value, "LE"));
  }
  /**
   * Decodes the span as a bigint byte count.
   */
  toBigInt() {
    return uint64ToNumber(this.bytes, "LE");
  }
  /**
   * Reads an 8-byte Span out of a larger buffer, starting at `start`.
   */
  static fromSlice(bytes, start) {
    return new _Span(bytes.slice(start, start + _Span.LENGTH));
  }
};

// src/bytes/topic.ts
var ENCODER4 = new TextEncoder();
var Topic = class _Topic extends Bytes {
  static LENGTH = 32;
  constructor(bytes) {
    super(bytes, 32);
  }
  /**
   * Derives a topic by hashing an arbitrary string with keccak256.
   */
  static fromString(value) {
    return new _Topic(keccak256(ENCODER4.encode(value)));
  }
};

// src/bytes/transaction-id.ts
var TransactionId = class extends Bytes {
  static LENGTH = 32;
  constructor(bytes) {
    super(bytes, 32);
  }
};
export {
  BatchId,
  Bytes,
  EthAddress,
  FeedIndex,
  Identifier,
  PeerAddress,
  PrivateKey,
  PublicKey,
  Reference,
  Signature,
  Span,
  Topic,
  TransactionId,
  base32ToUint8Array,
  base64ToUint8Array,
  binaryToUint8Array,
  commonPrefix,
  concatBytes,
  equals,
  hexToUint8Array,
  indexOf,
  numberToUint16,
  numberToUint256,
  numberToUint32,
  numberToUint64,
  numberToUint8,
  partition,
  sliceBytes,
  uint16ToNumber,
  uint256ToNumber,
  uint32ToNumber,
  uint64ToNumber,
  uint8ArrayToBase32,
  uint8ArrayToBase64,
  uint8ArrayToBinary,
  uint8ArrayToHex,
  uint8ToNumber
};
//# sourceMappingURL=index.js.map
