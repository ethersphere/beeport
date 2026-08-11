"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/chunk/index.ts
var chunk_exports = {};
__export(chunk_exports, {
  ChunkBuilder: () => ChunkBuilder,
  ChunkJoiner: () => ChunkJoiner,
  ChunkSplitter: () => ChunkSplitter,
  MAX_PAYLOAD_SIZE: () => MAX_PAYLOAD_SIZE,
  MIN_PAYLOAD_SIZE: () => MIN_PAYLOAD_SIZE,
  REPLICAS_OWNER: () => REPLICAS_OWNER,
  Uint8ArrayReader: () => Uint8ArrayReader,
  Uint8ArrayWriter: () => Uint8ArrayWriter,
  calculateChunkAddress: () => calculateChunkAddress,
  makeContentAddressedChunk: () => makeContentAddressedChunk,
  makeEncryptedReplicas: () => makeEncryptedReplicas,
  makeReplicas: () => makeReplicas,
  makeSOCAddress: () => makeSOCAddress,
  makeSingleOwnerChunk: () => makeSingleOwnerChunk,
  unmarshalContentAddressedChunk: () => unmarshalContentAddressedChunk,
  unmarshalSingleOwnerChunk: () => unmarshalSingleOwnerChunk
});
module.exports = __toCommonJS(chunk_exports);

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

// src/bytes/encoding.ts
function partition(bytes, size) {
  const partitions = [];
  for (let i = 0; i < bytes.length; i += size) {
    partitions.push(bytes.subarray(i, i + size));
  }
  return partitions;
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
function uint8ArrayToBase64(bytes) {
  return uint8ArrayToBase(bytes, BASE64_CHARS);
}
function base32ToUint8Array(base32) {
  return baseToUint8Array(base32, BASE32_CHARS);
}
function uint8ArrayToBase32(bytes) {
  return uint8ArrayToBase(bytes, BASE32_CHARS);
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

// src/crypto/keys.ts
var import_secp256k1 = require("@noble/curves/secp256k1.js");
var SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
function privateKeyToPublicKey(privateKey) {
  if (privateKey <= 0n || privateKey >= SECP256K1_N) {
    throw new Error("Invalid private key");
  }
  const point = import_secp256k1.secp256k1.Point.BASE.multiply(privateKey);
  return [point.x, point.y];
}
function compressPublicKey(publicKey) {
  return import_secp256k1.secp256k1.Point.fromAffine({ x: publicKey[0], y: publicKey[1] }).toBytes(true);
}
function publicKeyFromCompressed(compressed) {
  if (compressed.length !== 33 || compressed[0] !== 2 && compressed[0] !== 3) {
    throw new Error("Invalid compressed public key");
  }
  const point = import_secp256k1.secp256k1.Point.fromBytes(compressed);
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

// src/crypto/ecdsa.ts
var import_secp256k12 = require("@noble/curves/secp256k1.js");
function signMessage(message, privateKey) {
  const signature = import_secp256k12.secp256k1.sign(keccak256(message), privateKey, { prehash: false });
  const v = signature.recovery === 0 ? 27n : 28n;
  return [signature.r, signature.s, v];
}
function recoverPublicKey(message, r, s, v) {
  const recovery = v === 27n ? 0 : 1;
  const signature = new import_secp256k12.secp256k1.Signature(r, s, recovery);
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
function decryptChunk(encBytes, key) {
  return {
    span: uint64ToNumber(encryptSpan(key, encBytes.subarray(0, 8)), "LE"),
    data: encryptData(key, encBytes.subarray(8, 4104))
  };
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

// src/chunk/soc.ts
var REPLICAS_OWNER = hexToUint8Array("dc5b20847f43d67928f49cd4f85d696b5a7617b5");
var REPLICAS_PRIVATE_KEY = 1n << 248n;
var SIGNATURE_LENGTH = 65;
var SOC_SIGNATURE_OFFSET = Identifier.LENGTH;
var SOC_SPAN_OFFSET = Identifier.LENGTH + SIGNATURE_LENGTH;
var SOC_PAYLOAD_OFFSET = SOC_SPAN_OFFSET + Span.LENGTH;
var ETHEREUM_SIGNED_MESSAGE_PREFIX2 = new TextEncoder().encode("Ethereum Signed Message:\n32");
var REPLICA_COUNTS = [0, 2, 4, 8, 16];
var NEIGHBOURHOOD_BASES = [0, 2, 6, 14];
function socSigningDigest(identifier, cacAddress) {
  const toSign = keccak256(concatBytes(identifier, cacAddress));
  return concatBytes(ETHEREUM_SIGNED_MESSAGE_PREFIX2, toSign);
}
function signSoc(identifier, cacAddress, privateKey) {
  const [r, s, v] = signMessage(socSigningDigest(identifier, cacAddress), privateKey);
  return concatBytes(numberToUint256(r, "BE"), numberToUint256(s, "BE"), new Uint8Array([Number(v)]));
}
function recoverSocOwner(identifier, cacAddress, signature) {
  const r = uint256ToNumber(signature.subarray(0, 32), "BE");
  const s = uint256ToNumber(signature.subarray(32, 64), "BE");
  const v = BigInt(signature[64]);
  const publicKey = recoverPublicKey(socSigningDigest(identifier, cacAddress), r, s, v);
  return publicKeyToAddress(publicKey);
}
function makeSOCAddress(identifier, owner) {
  const id = new Identifier(identifier);
  const ownerAddress = new EthAddress(owner);
  return new Reference(keccak256(concatBytes(id.toUint8Array(), ownerAddress.toUint8Array())));
}
function makeSingleOwnerChunk(chunk, identifier, privateKey) {
  const id = new Identifier(identifier);
  const signature = signSoc(id.toUint8Array(), chunk.address.toUint8Array(), privateKey);
  const owner = new EthAddress(publicKeyToAddress(privateKeyToPublicKey(privateKey)));
  const address = makeSOCAddress(id, owner);
  const data = concatBytes(id.toUint8Array(), signature, chunk.data);
  return {
    data,
    identifier: id,
    signature: new Signature(signature),
    span: chunk.span,
    payload: chunk.payload,
    address,
    owner
  };
}
function unmarshalSingleOwnerChunk(data, address) {
  const bytes = data instanceof Bytes ? data.toUint8Array() : data;
  const expectedAddress = new Reference(address);
  const identifier = new Identifier(Bytes.fromSlice(bytes, 0, Identifier.LENGTH));
  const signature = bytes.slice(SOC_SIGNATURE_OFFSET, SOC_SIGNATURE_OFFSET + SIGNATURE_LENGTH);
  const cacAddress = calculateChunkAddress(bytes.slice(SOC_SPAN_OFFSET));
  const owner = new EthAddress(recoverSocOwner(identifier.toUint8Array(), cacAddress.toUint8Array(), signature));
  const socAddress = makeSOCAddress(identifier, owner);
  if (!socAddress.equals(expectedAddress)) {
    throw new Error("SOC data does not match given address");
  }
  const span = Span.fromSlice(bytes, SOC_SPAN_OFFSET);
  const payload = Bytes.fromSlice(bytes, SOC_PAYLOAD_OFFSET);
  return {
    data: bytes,
    identifier,
    signature: new Signature(signature),
    span,
    payload,
    address: socAddress,
    owner
  };
}
function neighbourhoodIndex(redundancyLevel, address) {
  return NEIGHBOURHOOD_BASES[redundancyLevel - 1] + (address[0] >> 8 - redundancyLevel);
}
function replicaIdentifiers(rootAddress, redundancyLevel) {
  const count = REPLICA_COUNTS[redundancyLevel];
  if (count === 0) return [];
  const covered = /* @__PURE__ */ new Set();
  const identifiers = [];
  for (let i = 0; i < 255 && identifiers.length < count; i++) {
    const identifier = new Uint8Array(32);
    identifier.set(rootAddress);
    identifier[0] = i;
    const address = makeSOCAddress(identifier, REPLICAS_OWNER).toUint8Array();
    const neighbourhood = neighbourhoodIndex(redundancyLevel, address);
    if (!covered.has(neighbourhood)) {
      covered.add(neighbourhood);
      identifiers.push(identifier);
    }
  }
  return identifiers;
}
function makeReplicas(rootChunk, redundancyLevel) {
  if (redundancyLevel === 0) return [];
  const rootAddress = rootChunk.hash().toUint8Array();
  const identifiers = replicaIdentifiers(rootAddress, redundancyLevel);
  return identifiers.map((identifier) => {
    const signature = signSoc(identifier, rootAddress, REPLICAS_PRIVATE_KEY);
    const data = concatBytes(identifier, signature, rootChunk.build());
    return { address: makeSOCAddress(identifier, REPLICAS_OWNER), data };
  });
}
function makeEncryptedReplicas(rootChunk, key, redundancyLevel) {
  if (redundancyLevel === 0) return [];
  const encryptedAddress = rootChunk.encryptedHash(key).address.toUint8Array();
  const identifiers = replicaIdentifiers(encryptedAddress, redundancyLevel);
  const encryptedBody = concatBytes(
    encryptSpan(key, numberToUint64(rootChunk.span, "LE")),
    encryptData(key, rootChunk.writer.buffer)
  );
  return identifiers.map((identifier) => {
    const signature = signSoc(identifier, encryptedAddress, REPLICAS_PRIVATE_KEY);
    const data = concatBytes(identifier, signature, encryptedBody);
    return { address: makeSOCAddress(identifier, REPLICAS_OWNER), data };
  });
}

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

// src/chunk/cac.ts
var MIN_PAYLOAD_SIZE = 1;
var MAX_PAYLOAD_SIZE = 4096;
function makeContentAddressedChunk(rawPayload, span) {
  if (typeof rawPayload === "string") {
    rawPayload = Bytes.fromUtf8(rawPayload);
  }
  if (rawPayload.length < MIN_PAYLOAD_SIZE || rawPayload.length > MAX_PAYLOAD_SIZE) {
    throw new RangeError(`payload size ${rawPayload.length} exceeds limits [${MIN_PAYLOAD_SIZE}, ${MAX_PAYLOAD_SIZE}]`);
  }
  const typedSpan = span ? typeof span === "bigint" ? Span.fromBigInt(span) : span : Span.fromBigInt(BigInt(rawPayload.length));
  const payload = new Bytes(rawPayload);
  const data = concatBytes(typedSpan.toUint8Array(), payload.toUint8Array());
  const address = calculateChunkAddress(data);
  const chunk = {
    data,
    span: typedSpan,
    payload,
    address,
    toSingleOwnerChunk: (identifier, privateKey) => makeSingleOwnerChunk(chunk, identifier, new PrivateKey(privateKey).toBigInt())
  };
  return chunk;
}
function unmarshalContentAddressedChunk(data) {
  const bytes = new Bytes(data);
  return makeContentAddressedChunk(bytes.toUint8Array().slice(Span.LENGTH), Span.fromSlice(bytes.toUint8Array(), 0));
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

// src/erasure-coding/levels.ts
var ERASURE_TABLES = [
  [[], []],
  // NONE (0)
  [
    [95, 69, 47, 29, 15, 6, 2, 1],
    [9, 8, 7, 6, 5, 4, 3, 2]
  ],
  // MEDIUM (1)
  [
    [105, 96, 87, 78, 70, 62, 54, 47, 40, 33, 27, 21, 16, 11, 7, 4, 2, 1],
    [21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]
  ],
  // STRONG (2)
  [
    [93, 88, 83, 78, 74, 69, 64, 60, 55, 51, 46, 42, 38, 34, 30, 27, 23, 20, 17, 14, 11, 9, 6, 4, 3, 2, 1],
    [31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5]
  ],
  // INSANE (3)
  [
    [
      37,
      36,
      35,
      34,
      33,
      32,
      31,
      30,
      29,
      28,
      27,
      26,
      25,
      24,
      23,
      22,
      21,
      20,
      19,
      18,
      17,
      16,
      15,
      14,
      13,
      12,
      11,
      10,
      9,
      8,
      7,
      6,
      5,
      4,
      3,
      2,
      1
    ],
    [
      89,
      87,
      86,
      84,
      83,
      81,
      80,
      78,
      76,
      75,
      73,
      71,
      70,
      68,
      66,
      65,
      63,
      61,
      59,
      58,
      56,
      54,
      52,
      50,
      48,
      47,
      45,
      43,
      40,
      38,
      36,
      34,
      31,
      29,
      26,
      23,
      19
    ]
  ]
  // PARANOID (4)
];
var ENC_ERASURE_TABLES = [
  [[], []],
  // NONE (0)
  [
    [47, 34, 23, 14, 7, 3, 1],
    [9, 8, 7, 6, 5, 4, 3]
  ],
  // encMEDIUM (1)
  [
    [52, 48, 43, 39, 35, 31, 27, 23, 20, 16, 13, 10, 8, 5, 3, 2, 1],
    [21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5]
  ],
  // encSTRONG (2)
  [
    [46, 44, 41, 39, 37, 34, 32, 30, 27, 25, 23, 21, 19, 17, 15, 13, 11, 10, 8, 7, 5, 4, 3, 2, 1],
    [31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 6]
  ],
  // encINSANE (3)
  [
    [18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [87, 84, 81, 78, 75, 71, 68, 65, 61, 58, 54, 50, 47, 43, 38, 34, 29, 23]
  ]
  // encPARANOID (4)
];
function tableGetParities(table, shards) {
  const [thresholds, parities] = table;
  for (let i = 0; i < thresholds.length; i++) {
    if (shards >= thresholds[i]) return parities[i];
  }
  return 0;
}
function getParities(level, shards, encrypted) {
  if (level <= 0 || level > 4) return 0;
  return tableGetParities(encrypted ? ENC_ERASURE_TABLES[level] : ERASURE_TABLES[level], shards);
}
var BRANCHES = 128;
var ENC_BRANCHES = 64;
function getMaxShards(level, encrypted) {
  if (level <= 0) return encrypted ? ENC_BRANCHES : BRANCHES;
  if (encrypted) {
    const parities = getParities(level, ENC_BRANCHES, true);
    return Math.floor((BRANCHES - parities) / 2);
  }
  return BRANCHES - getParities(level, BRANCHES, false);
}

// src/erasure-coding/span.ts
var CLEAR_TOP_BYTE_MASK = 0x00ffffffffffffffn;
function decodeRedundancyLevel(span) {
  const topByte = Number(span >> 56n & 0xffn);
  if (topByte <= 128) {
    return { level: 0, span };
  }
  return { level: topByte & 127, span: span & CLEAR_TOP_BYTE_MASK };
}
function referenceCount(span, level, encrypted) {
  const maxShards = BigInt(getMaxShards(level, encrypted));
  let branchSize = 4096n;
  let branchLevel = 1;
  while (branchSize < span) {
    branchSize *= maxShards;
    branchLevel++;
  }
  let referenceSize = 4096n;
  for (let i = 1; i < branchLevel - 1; i++) {
    referenceSize *= maxShards;
  }
  let dataShardCount = 1;
  let spanOffset = referenceSize;
  while (spanOffset < span) {
    spanOffset += referenceSize;
    dataShardCount++;
  }
  return { dataShardCount, parityShardCount: getParities(level, dataShardCount, encrypted) };
}

// src/chunk/joiner.ts
function isAllZero(bytes) {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}
var ChunkJoiner = class _ChunkJoiner {
  refSize;
  encrypted;
  fetch;
  onData;
  constructor(fetch, onData, encrypted = false) {
    this.fetch = fetch;
    this.onData = onData;
    this.encrypted = encrypted;
    this.refSize = encrypted ? 64 : 32;
  }
  /**
   * Fetches and reconstructs the full data behind an unencrypted chunk tree.
   */
  static async collect(address, fetch) {
    const parts = [];
    await new _ChunkJoiner(fetch, async (data) => {
      parts.push(data);
    }).join(address);
    return concatBytes(...parts);
  }
  /**
   * Fetches and reconstructs the full data behind an encrypted chunk tree,
   * given the root's decryption key.
   */
  static async collectEncrypted(address, key, fetch) {
    const parts = [];
    await new _ChunkJoiner(
      fetch,
      async (data) => {
        parts.push(data);
      },
      true
    ).join(address, key);
    return concatBytes(...parts);
  }
  /**
   * Fetches the chunk at `address` and recursively descends into its
   * children (skipping any parity references), emitting leaf payloads to
   * `onData` in order as they're reached.
   */
  async join(address, key) {
    const raw = await this.fetch(address);
    let rawSpan;
    let data;
    if (this.encrypted && key) {
      ;
      ({ span: rawSpan, data } = decryptChunk(raw, key));
    } else {
      rawSpan = uint64ToNumber(raw.subarray(0, 8), "LE");
      data = raw.subarray(8, 4104);
    }
    const { level, span } = decodeRedundancyLevel(rawSpan);
    if (span <= 4096n) {
      await this.onData(data.subarray(0, Number(span)));
      return;
    }
    const maxRefs = Math.floor(4096 / this.refSize);
    const dataRefCount = level > 0 ? referenceCount(span, level, this.encrypted).dataShardCount : maxRefs;
    for (let i = 0; i < Math.min(dataRefCount, maxRefs); i++) {
      const ref = data.subarray(i * this.refSize, (i + 1) * this.refSize);
      const childAddress = ref.subarray(0, 32);
      if (level === 0 && isAllZero(childAddress)) break;
      await this.join(childAddress, this.encrypted ? ref.subarray(32, 64) : void 0);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChunkBuilder,
  ChunkJoiner,
  ChunkSplitter,
  MAX_PAYLOAD_SIZE,
  MIN_PAYLOAD_SIZE,
  REPLICAS_OWNER,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  calculateChunkAddress,
  makeContentAddressedChunk,
  makeEncryptedReplicas,
  makeReplicas,
  makeSOCAddress,
  makeSingleOwnerChunk,
  unmarshalContentAddressedChunk,
  unmarshalSingleOwnerChunk
});
//# sourceMappingURL=index.cjs.map
