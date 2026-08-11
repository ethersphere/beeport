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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BatchId: () => BatchId,
  Bytes: () => Bytes,
  ChunkBuilder: () => ChunkBuilder,
  ChunkJoiner: () => ChunkJoiner,
  ChunkSplitter: () => ChunkSplitter,
  EthAddress: () => EthAddress,
  FeedIndex: () => FeedIndex,
  Fork: () => Fork,
  Identifier: () => Identifier,
  MAX_PAYLOAD_SIZE: () => MAX_PAYLOAD_SIZE,
  MIN_PAYLOAD_SIZE: () => MIN_PAYLOAD_SIZE,
  MantarayNode: () => MantarayNode,
  PeerAddress: () => PeerAddress,
  PrivateKey: () => PrivateKey,
  PublicKey: () => PublicKey,
  REPLICAS_OWNER: () => REPLICAS_OWNER,
  Reference: () => Reference,
  Signature: () => Signature,
  Span: () => Span,
  Stamper: () => Stamper,
  Topic: () => Topic,
  TransactionId: () => TransactionId,
  Uint8ArrayReader: () => Uint8ArrayReader,
  Uint8ArrayWriter: () => Uint8ArrayWriter,
  approximateOverheadForRedundancyLevel: () => approximateOverheadForRedundancyLevel,
  base32ToUint8Array: () => base32ToUint8Array,
  base64ToUint8Array: () => base64ToUint8Array,
  binaryToUint8Array: () => binaryToUint8Array,
  calculateChunkAddress: () => calculateChunkAddress,
  checksumEncode: () => checksumEncode,
  commonPrefix: () => commonPrefix,
  compressPublicKey: () => compressPublicKey,
  concatBytes: () => concatBytes,
  convertEnvelopeToMarshaledStamp: () => convertEnvelopeToMarshaledStamp,
  decodeRedundancyLevel: () => decodeRedundancyLevel,
  decryptChunk: () => decryptChunk,
  encodeRedundancyLevel: () => encodeRedundancyLevel,
  encryptData: () => encryptData,
  encryptSegments: () => encryptSegments,
  encryptSpan: () => encryptSpan,
  equals: () => equals,
  getDepthForSize: () => getDepthForSize,
  getMaxShards: () => getMaxShards,
  getParities: () => getParities,
  getRedundancyStat: () => getRedundancyStat,
  getRedundancyStats: () => getRedundancyStats,
  getStampEffectiveBytes: () => getStampEffectiveBytes,
  getStampEffectiveBytesBreakpoints: () => getStampEffectiveBytesBreakpoints,
  getStampTheoreticalBytes: () => getStampTheoreticalBytes,
  getStampUsage: () => getStampUsage,
  hexToUint8Array: () => hexToUint8Array,
  indexOf: () => indexOf,
  keccak256: () => keccak256,
  makeContentAddressedChunk: () => makeContentAddressedChunk,
  makeEncryptedReplicas: () => makeEncryptedReplicas,
  makeErasureBatch: () => makeErasureBatch,
  makeIntermediateChunkHandler: () => makeIntermediateChunkHandler,
  makeReplicas: () => makeReplicas,
  makeSOCAddress: () => makeSOCAddress,
  makeSingleOwnerChunk: () => makeSingleOwnerChunk,
  marshalStamp: () => marshalStamp,
  numberToUint16: () => numberToUint16,
  numberToUint256: () => numberToUint256,
  numberToUint32: () => numberToUint32,
  numberToUint64: () => numberToUint64,
  numberToUint8: () => numberToUint8,
  partition: () => partition,
  privateKeyToPublicKey: () => privateKeyToPublicKey,
  publicKeyFromCompressed: () => publicKeyFromCompressed,
  publicKeyToAddress: () => publicKeyToAddress,
  recoverPublicKey: () => recoverPublicKey,
  referenceCount: () => referenceCount,
  rsDecode: () => rsDecode,
  rsEncode: () => rsEncode,
  signHash: () => signHash,
  signMessage: () => signMessage,
  sliceBytes: () => sliceBytes,
  stamp: () => stamp,
  uint16ToNumber: () => uint16ToNumber,
  uint256ToNumber: () => uint256ToNumber,
  uint32ToNumber: () => uint32ToNumber,
  uint64ToNumber: () => uint64ToNumber,
  uint8ArrayToBase32: () => uint8ArrayToBase32,
  uint8ArrayToBase64: () => uint8ArrayToBase64,
  uint8ArrayToBinary: () => uint8ArrayToBinary,
  uint8ArrayToHex: () => uint8ArrayToHex,
  uint8ToNumber: () => uint8ToNumber,
  unmarshalContentAddressedChunk: () => unmarshalContentAddressedChunk,
  unmarshalSingleOwnerChunk: () => unmarshalSingleOwnerChunk,
  verifySignature: () => verifySignature,
  xorCypher: () => xorCypher
});
module.exports = __toCommonJS(index_exports);

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
var import_secp256k12 = require("@noble/curves/secp256k1.js");
function signMessage(message, privateKey) {
  const signature = import_secp256k12.secp256k1.sign(keccak256(message), privateKey, { prehash: false });
  const v = signature.recovery === 0 ? 27n : 28n;
  return [signature.r, signature.s, v];
}
function signHash(hash, privateKey) {
  const hashBytes = new Uint8Array(32);
  let remaining = hash;
  for (let i = 31; i >= 0; i--) {
    hashBytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  const signature = import_secp256k12.secp256k1.sign(hashBytes, privateKey, { prehash: false });
  const v = signature.recovery === 0 ? 27n : 28n;
  return [signature.r, signature.s, v];
}
function recoverPublicKey(message, r, s, v) {
  const recovery = v === 27n ? 0 : 1;
  const signature = new import_secp256k12.secp256k1.Signature(r, s, recovery);
  const point = signature.recoverPublicKey(keccak256(message));
  return [point.x, point.y];
}
function verifySignature(message, publicKey, r, s) {
  const signatureBytes = new import_secp256k12.secp256k1.Signature(r, s).toBytes("compact");
  const publicKeyBytes = import_secp256k12.secp256k1.Point.fromAffine({ x: publicKey[0], y: publicKey[1] }).toBytes(true);
  return import_secp256k12.secp256k1.verify(signatureBytes, keccak256(message), publicKeyBytes, { prehash: false });
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
function approximateOverheadForRedundancyLevel(chunks, level, encrypted) {
  if (level <= 0 || chunks <= 0) {
    return 0;
  }
  return getParities(level, chunks, encrypted) / chunks;
}
var MEDIUM_STAT = { label: "medium", value: 1, errorTolerance: 0.01 };
var STRONG_STAT = { label: "strong", value: 2, errorTolerance: 0.05 };
var INSANE_STAT = { label: "insane", value: 3, errorTolerance: 0.1 };
var PARANOID_STAT = { label: "paranoid", value: 4, errorTolerance: 0.5 };
function getRedundancyStats() {
  return { medium: MEDIUM_STAT, strong: STRONG_STAT, insane: INSANE_STAT, paranoid: PARANOID_STAT };
}
function getRedundancyStat(level) {
  if (typeof level === "string") {
    switch (level.toLowerCase()) {
      case "medium":
        return MEDIUM_STAT;
      case "strong":
        return STRONG_STAT;
      case "insane":
        return INSANE_STAT;
      case "paranoid":
        return PARANOID_STAT;
      default:
        throw new Error(`Unknown redundancy level '${level}'`);
    }
  }
  switch (level) {
    case 1:
      return MEDIUM_STAT;
    case 2:
      return STRONG_STAT;
    case 3:
      return INSANE_STAT;
    case 4:
      return PARANOID_STAT;
    default:
      throw new Error(`Unknown redundancy level '${level}'`);
  }
}

// src/erasure-coding/span.ts
var CLEAR_TOP_BYTE_MASK = 0x00ffffffffffffffn;
function encodeRedundancyLevel(span, level) {
  return span & CLEAR_TOP_BYTE_MASK | BigInt(level | 128) << 56n;
}
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

// src/encryption/xor-cipher.ts
function xorCypher(bytes, key) {
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ key[i % key.length];
  }
  return result;
}

// src/erasure-coding/reed-solomon.ts
var LOG_TABLE = new Uint8Array([
  0,
  0,
  1,
  25,
  2,
  50,
  26,
  198,
  3,
  223,
  51,
  238,
  27,
  104,
  199,
  75,
  4,
  100,
  224,
  14,
  52,
  141,
  239,
  129,
  28,
  193,
  105,
  248,
  200,
  8,
  76,
  113,
  5,
  138,
  101,
  47,
  225,
  36,
  15,
  33,
  53,
  147,
  142,
  218,
  240,
  18,
  130,
  69,
  29,
  181,
  194,
  125,
  106,
  39,
  249,
  185,
  201,
  154,
  9,
  120,
  77,
  228,
  114,
  166,
  6,
  191,
  139,
  98,
  102,
  221,
  48,
  253,
  226,
  152,
  37,
  179,
  16,
  145,
  34,
  136,
  54,
  208,
  148,
  206,
  143,
  150,
  219,
  189,
  241,
  210,
  19,
  92,
  131,
  56,
  70,
  64,
  30,
  66,
  182,
  163,
  195,
  72,
  126,
  110,
  107,
  58,
  40,
  84,
  250,
  133,
  186,
  61,
  202,
  94,
  155,
  159,
  10,
  21,
  121,
  43,
  78,
  212,
  229,
  172,
  115,
  243,
  167,
  87,
  7,
  112,
  192,
  247,
  140,
  128,
  99,
  13,
  103,
  74,
  222,
  237,
  49,
  197,
  254,
  24,
  227,
  165,
  153,
  119,
  38,
  184,
  180,
  124,
  17,
  68,
  146,
  217,
  35,
  32,
  137,
  46,
  55,
  63,
  209,
  91,
  149,
  188,
  207,
  205,
  144,
  135,
  151,
  178,
  220,
  252,
  190,
  97,
  242,
  86,
  211,
  171,
  20,
  42,
  93,
  158,
  132,
  60,
  57,
  83,
  71,
  109,
  65,
  162,
  31,
  45,
  67,
  216,
  183,
  123,
  164,
  118,
  196,
  23,
  73,
  236,
  127,
  12,
  111,
  246,
  108,
  161,
  59,
  82,
  41,
  157,
  85,
  170,
  251,
  96,
  134,
  177,
  187,
  204,
  62,
  90,
  203,
  89,
  95,
  176,
  156,
  169,
  160,
  81,
  11,
  245,
  22,
  235,
  122,
  117,
  44,
  215,
  79,
  174,
  213,
  233,
  230,
  231,
  173,
  232,
  116,
  214,
  244,
  234,
  168,
  80,
  88,
  175
]);
var EXP_TABLE = new Uint8Array([
  1,
  2,
  4,
  8,
  16,
  32,
  64,
  128,
  29,
  58,
  116,
  232,
  205,
  135,
  19,
  38,
  76,
  152,
  45,
  90,
  180,
  117,
  234,
  201,
  143,
  3,
  6,
  12,
  24,
  48,
  96,
  192,
  157,
  39,
  78,
  156,
  37,
  74,
  148,
  53,
  106,
  212,
  181,
  119,
  238,
  193,
  159,
  35,
  70,
  140,
  5,
  10,
  20,
  40,
  80,
  160,
  93,
  186,
  105,
  210,
  185,
  111,
  222,
  161,
  95,
  190,
  97,
  194,
  153,
  47,
  94,
  188,
  101,
  202,
  137,
  15,
  30,
  60,
  120,
  240,
  253,
  231,
  211,
  187,
  107,
  214,
  177,
  127,
  254,
  225,
  223,
  163,
  91,
  182,
  113,
  226,
  217,
  175,
  67,
  134,
  17,
  34,
  68,
  136,
  13,
  26,
  52,
  104,
  208,
  189,
  103,
  206,
  129,
  31,
  62,
  124,
  248,
  237,
  199,
  147,
  59,
  118,
  236,
  197,
  151,
  51,
  102,
  204,
  133,
  23,
  46,
  92,
  184,
  109,
  218,
  169,
  79,
  158,
  33,
  66,
  132,
  21,
  42,
  84,
  168,
  77,
  154,
  41,
  82,
  164,
  85,
  170,
  73,
  146,
  57,
  114,
  228,
  213,
  183,
  115,
  230,
  209,
  191,
  99,
  198,
  145,
  63,
  126,
  252,
  229,
  215,
  179,
  123,
  246,
  241,
  255,
  227,
  219,
  171,
  75,
  150,
  49,
  98,
  196,
  149,
  55,
  110,
  220,
  165,
  87,
  174,
  65,
  130,
  25,
  50,
  100,
  200,
  141,
  7,
  14,
  28,
  56,
  112,
  224,
  221,
  167,
  83,
  166,
  81,
  162,
  89,
  178,
  121,
  242,
  249,
  239,
  195,
  155,
  43,
  86,
  172,
  69,
  138,
  9,
  18,
  36,
  72,
  144,
  61,
  122,
  244,
  245,
  247,
  243,
  251,
  235,
  203,
  139,
  11,
  22,
  44,
  88,
  176,
  125,
  250,
  233,
  207,
  131,
  27,
  54,
  108,
  216,
  173,
  71,
  142
]);
function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}
function gfDiv(a, b) {
  if (a === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] - LOG_TABLE[b] + 255) % 255];
}
function gfExp(a, n) {
  if (n === 0) return 1;
  if (a === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] * n % 255];
}
var GFMatrix = class _GFMatrix {
  rows;
  cols;
  data;
  constructor(rows, cols, data) {
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? new Uint8Array(rows * cols);
  }
  get(r, c) {
    return this.data[r * this.cols + c];
  }
  set(r, c, v) {
    this.data[r * this.cols + c] = v;
  }
  static identity(n) {
    const m = new _GFMatrix(n, n);
    for (let i = 0; i < n; i++) m.set(i, i, 1);
    return m;
  }
  // vandermonde[r][c] = gfExp(r, c)
  static vandermonde(rows, cols) {
    const m = new _GFMatrix(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        m.set(r, c, gfExp(r, c));
      }
    }
    return m;
  }
  multiply(right) {
    const result = new _GFMatrix(this.rows, right.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < right.cols; c++) {
        let val = 0;
        for (let i = 0; i < this.cols; i++) {
          val ^= gfMul(this.get(r, i), right.get(i, c));
        }
        result.set(r, c, val);
      }
    }
    return result;
  }
  augment(right) {
    const result = new _GFMatrix(this.rows, this.cols + right.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) result.set(r, c, this.get(r, c));
      for (let c = 0; c < right.cols; c++) result.set(r, this.cols + c, right.get(r, c));
    }
    return result;
  }
  subMatrix(rmin, cmin, rmax, cmax) {
    const result = new _GFMatrix(rmax - rmin, cmax - cmin);
    for (let r = rmin; r < rmax; r++) {
      for (let c = cmin; c < cmax; c++) {
        result.set(r - rmin, c - cmin, this.get(r, c));
      }
    }
    return result;
  }
  swapRows(r1, r2) {
    for (let c = 0; c < this.cols; c++) {
      const tmp = this.get(r1, c);
      this.set(r1, c, this.get(r2, c));
      this.set(r2, c, tmp);
    }
  }
  invert() {
    const size = this.rows;
    const work = this.augment(_GFMatrix.identity(size));
    work.gaussianElimination();
    return work.subMatrix(0, size, size, size * 2);
  }
  gaussianElimination() {
    const rows = this.rows;
    const cols = this.cols;
    for (let r = 0; r < rows; r++) {
      if (this.get(r, r) === 0) {
        for (let rowBelow = r + 1; rowBelow < rows; rowBelow++) {
          if (this.get(rowBelow, r) !== 0) {
            this.swapRows(r, rowBelow);
            break;
          }
        }
      }
      if (this.get(r, r) === 0) throw new Error("matrix is singular");
      if (this.get(r, r) !== 1) {
        const scale = gfDiv(1, this.get(r, r));
        for (let c = 0; c < cols; c++) {
          this.set(r, c, gfMul(this.get(r, c), scale));
        }
      }
      for (let rowBelow = r + 1; rowBelow < rows; rowBelow++) {
        if (this.get(rowBelow, r) !== 0) {
          const scale = this.get(rowBelow, r);
          for (let c = 0; c < cols; c++) {
            this.set(rowBelow, c, this.get(rowBelow, c) ^ gfMul(scale, this.get(r, c)));
          }
        }
      }
    }
    for (let d = 0; d < rows; d++) {
      for (let rowAbove = 0; rowAbove < d; rowAbove++) {
        if (this.get(rowAbove, d) !== 0) {
          const scale = this.get(rowAbove, d);
          for (let c = 0; c < cols; c++) {
            this.set(rowAbove, c, this.get(rowAbove, c) ^ gfMul(scale, this.get(d, c)));
          }
        }
      }
    }
  }
};
var matrixCache = /* @__PURE__ */ new Map();
function buildMatrix(dataShards, parityShards) {
  const key = `${dataShards},${parityShards}`;
  let matrix = matrixCache.get(key);
  if (!matrix) {
    const totalShards = dataShards + parityShards;
    const vm = GFMatrix.vandermonde(totalShards, dataShards);
    const top = vm.subMatrix(0, 0, dataShards, dataShards);
    matrix = vm.multiply(top.invert());
    matrixCache.set(key, matrix);
  }
  return matrix;
}
function getParityRows(dataShards, parityShards) {
  const matrix = buildMatrix(dataShards, parityShards);
  const rows = [];
  for (let i = 0; i < parityShards; i++) {
    const row = [];
    for (let c = 0; c < dataShards; c++) row.push(matrix.get(dataShards + i, c));
    rows.push(row);
  }
  return rows;
}
function rsEncode(data, parityCount) {
  if (parityCount === 0) return [];
  const dataCount = data.length;
  const shardSize = data[0].length;
  const rows = getParityRows(dataCount, parityCount);
  return rows.map((row) => {
    const parity = new Uint8Array(shardSize);
    for (let j = 0; j < shardSize; j++) {
      let val = 0;
      for (let k = 0; k < dataCount; k++) {
        val ^= gfMul(row[k], data[k][j]);
      }
      parity[j] = val;
    }
    return parity;
  });
}
function rsDecode(shards, dataCount, parityCount) {
  const totalCount = dataCount + parityCount;
  if (shards.length !== totalCount) {
    throw new Error(`rsDecode: expected ${totalCount} shards, got ${shards.length}`);
  }
  let missingData = false;
  for (let i = 0; i < dataCount; i++) {
    if (!shards[i]) {
      missingData = true;
      break;
    }
  }
  if (!missingData) return shards.slice(0, dataCount);
  const presentRows = [];
  let shardSize = -1;
  for (let i = 0; i < totalCount && presentRows.length < dataCount; i++) {
    const shard = shards[i];
    if (shard) {
      presentRows.push(i);
      if (shardSize < 0) shardSize = shard.length;
    }
  }
  if (presentRows.length < dataCount) {
    throw new Error(`rsDecode: only ${presentRows.length} of ${dataCount} required shards present`);
  }
  const matrix = buildMatrix(dataCount, parityCount);
  const sub = new GFMatrix(dataCount, dataCount);
  for (let r = 0; r < dataCount; r++) {
    for (let c = 0; c < dataCount; c++) sub.set(r, c, matrix.get(presentRows[r], c));
  }
  const decodeMatrix = sub.invert();
  const result = [];
  for (let i = 0; i < dataCount; i++) {
    const existing = shards[i];
    if (existing) {
      result.push(existing);
      continue;
    }
    const out = new Uint8Array(shardSize);
    for (let j = 0; j < shardSize; j++) {
      let val = 0;
      for (let r = 0; r < dataCount; r++) {
        val ^= gfMul(decodeMatrix.get(i, r), shards[presentRows[r]][j]);
      }
      out[j] = val;
    }
    result.push(out);
  }
  return result;
}

// src/erasure-coding/batch.ts
function chunkFromBytes(bytes) {
  const chunk = new ChunkBuilder(uint64ToNumber(bytes.subarray(0, 8), "LE"));
  chunk.writer.buffer.set(bytes.subarray(8, 4104));
  return chunk;
}
function makeIntermediateChunkHandler(level) {
  return (chunk, hasParity) => {
    if (hasParity && level > 0) {
      chunk.span = encodeRedundancyLevel(chunk.span, level);
    }
  };
}
function makeErasureBatch(level, encrypted, onChunk) {
  return async (batch) => {
    for (const { chunk, key } of batch) {
      await onChunk(chunk, key);
    }
    if (level <= 0) return [];
    if (encrypted) {
      const parityCount2 = getParities(level, batch.length, true);
      if (parityCount2 === 0) return [];
      const shardBytes = batch.map(
        ({ chunk, key }) => concatBytes(encryptSpan(key, numberToUint64(chunk.span, "LE")), encryptData(key, chunk.writer.buffer))
      );
      const parityShards2 = rsEncode(shardBytes, parityCount2);
      const parityEntries2 = [];
      for (const bytes of parityShards2) {
        const parityChunk = chunkFromBytes(bytes);
        await onChunk(parityChunk);
        parityEntries2.push({ chunk: parityChunk });
      }
      return parityEntries2;
    }
    const parityCount = getParities(level, batch.length, false);
    if (parityCount === 0) return [];
    const dataBytes = batch.map(({ chunk }) => chunk.build());
    const parityShards = rsEncode(dataBytes, parityCount);
    const parityEntries = [];
    for (const bytes of parityShards) {
      const chunk = chunkFromBytes(bytes);
      await onChunk(chunk);
      parityEntries.push({ chunk });
    }
    return parityEntries;
  };
}

// src/mantaray/node.ts
var ENCODER5 = new TextEncoder();
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
    path = path instanceof Uint8Array ? path : ENCODER5.encode(path);
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
    path = path instanceof Uint8Array ? path : ENCODER5.encode(path);
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
    const target = path instanceof Uint8Array ? path : ENCODER5.encode(path);
    const [closest, matched] = this.findClosest(target);
    return matched.length === target.length ? closest : null;
  }
  /**
   * Finds the closest node in the tree to the given path.
   */
  findClosest(path, current = new Uint8Array()) {
    path = path instanceof Uint8Array ? path : ENCODER5.encode(path);
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
var ENCODER6 = new TextEncoder();
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
        concatBytes(new Uint8Array([0, 0]), ENCODER6.encode(JSON.stringify(this.node.metadata))),
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

// src/stamper/capacity.ts
function getStampUsage(utilization, depth, bucketDepth) {
  return utilization / Math.pow(2, depth - bucketDepth);
}
function getStampTheoreticalBytes(depth) {
  return 4096 * 2 ** depth;
}
var MAX_UTILIZATION = 0.9;
function parseSizeToBytes(size) {
  const units = { B: 1, kB: 1e3, MB: 1e3 ** 2, GB: 1e3 ** 3, TB: 1e3 ** 4, PB: 1e3 ** 5 };
  const match = size.match(/^([\d.]+)\s*(B|kB|MB|GB|TB|PB)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  return Math.ceil(parseFloat(match[1]) * units[match[2]]);
}
var DEFAULT_EFFECTIVE_SIZE_BREAKPOINTS = [
  [17, "0.00004089 GB"],
  [18, "0.00609 GB"],
  [19, "0.10249 GB"],
  [20, "0.62891 GB"],
  [21, "2.38 GB"],
  [22, "7.07 GB"],
  [23, "18.24 GB"],
  [24, "43.04 GB"],
  [25, "96.5 GB"],
  [26, "208.52 GB"],
  [27, "435.98 GB"],
  [28, "908.81 GB"],
  [29, "1870 GB"],
  [30, "3810 GB"],
  [31, "7730 GB"],
  [32, "15610 GB"],
  [33, "31430 GB"],
  [34, "63150 GB"]
];
var ENCRYPTION_OFF_BREAKPOINTS = [
  [
    [17, "44.70 kB"],
    [18, "6.66 MB"],
    [19, "112.06 MB"],
    [20, "687.62 MB"],
    [21, "2.60 GB"],
    [22, "7.73 GB"],
    [23, "19.94 GB"],
    [24, "47.06 GB"],
    [25, "105.51 GB"],
    [26, "227.98 GB"],
    [27, "476.68 GB"],
    [28, "993.65 GB"],
    [29, "2.04 TB"],
    [30, "4.17 TB"],
    [31, "8.45 TB"],
    [32, "17.07 TB"],
    [33, "34.36 TB"],
    [34, "69.04 TB"],
    [35, "138.54 TB"],
    [36, "277.72 TB"],
    [37, "556.35 TB"],
    [38, "1.11 PB"],
    [39, "2.23 PB"],
    [40, "4.46 PB"],
    [41, "8.93 PB"]
  ],
  // NONE
  [
    [17, "41.56 kB"],
    [18, "6.19 MB"],
    [19, "104.18 MB"],
    [20, "639.27 MB"],
    [21, "2.41 GB"],
    [22, "7.18 GB"],
    [23, "18.54 GB"],
    [24, "43.75 GB"],
    [25, "98.09 GB"],
    [26, "211.95 GB"],
    [27, "443.16 GB"],
    [28, "923.78 GB"],
    [29, "1.90 TB"],
    [30, "3.88 TB"],
    [31, "7.86 TB"],
    [32, "15.87 TB"],
    [33, "31.94 TB"],
    [34, "64.19 TB"],
    [35, "128.80 TB"],
    [36, "258.19 TB"],
    [37, "517.23 TB"],
    [38, "1.04 PB"],
    [39, "2.07 PB"],
    [40, "4.15 PB"],
    [41, "8.30 PB"]
  ],
  // MEDIUM
  [
    [17, "37.37 kB"],
    [18, "5.57 MB"],
    [19, "93.68 MB"],
    [20, "574.81 MB"],
    [21, "2.17 GB"],
    [22, "6.46 GB"],
    [23, "16.67 GB"],
    [24, "39.34 GB"],
    [25, "88.20 GB"],
    [26, "190.58 GB"],
    [27, "398.47 GB"],
    [28, "830.63 GB"],
    [29, "1.71 TB"],
    [30, "3.49 TB"],
    [31, "7.07 TB"],
    [32, "14.27 TB"],
    [33, "28.72 TB"],
    [34, "57.71 TB"],
    [35, "115.81 TB"],
    [36, "232.16 TB"],
    [37, "465.07 TB"],
    [38, "931.23 TB"],
    [39, "1.86 PB"],
    [40, "3.73 PB"],
    [41, "7.46 PB"]
  ],
  // STRONG
  [
    [17, "33.88 kB"],
    [18, "5.05 MB"],
    [19, "84.92 MB"],
    [20, "521.09 MB"],
    [21, "1.97 GB"],
    [22, "5.86 GB"],
    [23, "15.11 GB"],
    [24, "35.66 GB"],
    [25, "79.96 GB"],
    [26, "172.77 GB"],
    [27, "361.23 GB"],
    [28, "753.00 GB"],
    [29, "1.55 TB"],
    [30, "3.16 TB"],
    [31, "6.41 TB"],
    [32, "12.93 TB"],
    [33, "26.04 TB"],
    [34, "52.32 TB"],
    [35, "104.99 TB"],
    [36, "210.46 TB"],
    [37, "421.61 TB"],
    [38, "844.20 TB"],
    [39, "1.69 PB"],
    [40, "3.38 PB"],
    [41, "6.77 PB"]
  ],
  // INSANE
  [
    [17, "13.27 kB"],
    [18, "1.98 MB"],
    [19, "33.27 MB"],
    [20, "204.14 MB"],
    [21, "771.13 MB"],
    [22, "2.29 GB"],
    [23, "5.92 GB"],
    [24, "13.97 GB"],
    [25, "31.32 GB"],
    [26, "67.68 GB"],
    [27, "141.51 GB"],
    [28, "294.99 GB"],
    [29, "606.90 GB"],
    [30, "1.24 TB"],
    [31, "2.51 TB"],
    [32, "5.07 TB"],
    [33, "10.20 TB"],
    [34, "20.50 TB"],
    [35, "41.13 TB"],
    [36, "82.45 TB"],
    [37, "165.17 TB"],
    [38, "330.72 TB"],
    [39, "661.97 TB"],
    [40, "1.32 PB"],
    [41, "2.65 PB"]
  ]
  // PARANOID
];
var ENCRYPTION_ON_BREAKPOINTS = [
  [
    [17, "44.35 kB"],
    [18, "6.61 MB"],
    [19, "111.18 MB"],
    [20, "682.21 MB"],
    [21, "2.58 GB"],
    [22, "7.67 GB"],
    [23, "19.78 GB"],
    [24, "46.69 GB"],
    [25, "104.68 GB"],
    [26, "226.19 GB"],
    [27, "472.93 GB"],
    [28, "985.83 GB"],
    [29, "2.03 TB"],
    [30, "4.14 TB"],
    [31, "8.39 TB"],
    [32, "16.93 TB"],
    [33, "34.09 TB"],
    [34, "68.50 TB"],
    [35, "137.45 TB"],
    [36, "275.53 TB"],
    [37, "551.97 TB"],
    [38, "1.11 PB"],
    [39, "2.21 PB"],
    [40, "4.43 PB"],
    [41, "8.86 PB"]
  ],
  // NONE
  [
    [17, "40.89 kB"],
    [18, "6.09 MB"],
    [19, "102.49 MB"],
    [20, "628.91 MB"],
    [21, "2.38 GB"],
    [22, "7.07 GB"],
    [23, "18.24 GB"],
    [24, "43.04 GB"],
    [25, "96.50 GB"],
    [26, "208.52 GB"],
    [27, "435.98 GB"],
    [28, "908.81 GB"],
    [29, "1.87 TB"],
    [30, "3.81 TB"],
    [31, "7.73 TB"],
    [32, "15.61 TB"],
    [33, "31.43 TB"],
    [34, "63.15 TB"],
    [35, "126.71 TB"],
    [36, "254.01 TB"],
    [37, "508.85 TB"],
    [38, "1.02 PB"],
    [39, "2.04 PB"],
    [40, "4.08 PB"],
    [41, "8.17 PB"]
  ],
  // MEDIUM
  [
    [17, "36.73 kB"],
    [18, "5.47 MB"],
    [19, "92.07 MB"],
    [20, "564.95 MB"],
    [21, "2.13 GB"],
    [22, "6.35 GB"],
    [23, "16.38 GB"],
    [24, "38.66 GB"],
    [25, "86.69 GB"],
    [26, "187.31 GB"],
    [27, "391.64 GB"],
    [28, "816.39 GB"],
    [29, "1.68 TB"],
    [30, "3.43 TB"],
    [31, "6.94 TB"],
    [32, "14.02 TB"],
    [33, "28.23 TB"],
    [34, "56.72 TB"],
    [35, "113.82 TB"],
    [36, "228.18 TB"],
    [37, "457.10 TB"],
    [38, "915.26 TB"],
    [39, "1.83 PB"],
    [40, "3.67 PB"],
    [41, "7.34 PB"]
  ],
  // STRONG
  [
    [17, "33.26 kB"],
    [18, "4.96 MB"],
    [19, "83.38 MB"],
    [20, "511.65 MB"],
    [21, "1.93 GB"],
    [22, "5.75 GB"],
    [23, "14.84 GB"],
    [24, "35.02 GB"],
    [25, "78.51 GB"],
    [26, "169.64 GB"],
    [27, "354.69 GB"],
    [28, "739.37 GB"],
    [29, "1.52 TB"],
    [30, "3.10 TB"],
    [31, "6.29 TB"],
    [32, "12.70 TB"],
    [33, "25.57 TB"],
    [34, "51.37 TB"],
    [35, "103.08 TB"],
    [36, "206.65 TB"],
    [37, "413.98 TB"],
    [38, "828.91 TB"],
    [39, "1.66 PB"],
    [40, "3.32 PB"],
    [41, "6.64 PB"]
  ],
  // INSANE
  [
    [17, "13.17 kB"],
    [18, "1.96 MB"],
    [19, "33.01 MB"],
    [20, "202.53 MB"],
    [21, "765.05 MB"],
    [22, "2.28 GB"],
    [23, "5.87 GB"],
    [24, "13.86 GB"],
    [25, "31.08 GB"],
    [26, "67.15 GB"],
    [27, "140.40 GB"],
    [28, "292.67 GB"],
    [29, "602.12 GB"],
    [30, "1.23 TB"],
    [31, "2.49 TB"],
    [32, "5.03 TB"],
    [33, "10.12 TB"],
    [34, "20.34 TB"],
    [35, "40.80 TB"],
    [36, "81.80 TB"],
    [37, "163.87 TB"],
    [38, "328.11 TB"],
    [39, "656.76 TB"],
    [40, "1.31 PB"],
    [41, "2.63 PB"]
  ]
  // PARANOID
];
function getStampEffectiveBytes(depth, encryption, erasureCodeLevel) {
  if (depth < 17) {
    return 0;
  }
  if (encryption !== void 0 && erasureCodeLevel !== void 0) {
    const breakpoints = (encryption ? ENCRYPTION_ON_BREAKPOINTS : ENCRYPTION_OFF_BREAKPOINTS)[erasureCodeLevel];
    const entry = breakpoints?.find(([batchDepth]) => batchDepth === depth);
    if (entry) {
      return parseSizeToBytes(entry[1]);
    }
  } else {
    const entry = DEFAULT_EFFECTIVE_SIZE_BREAKPOINTS.find(([batchDepth]) => batchDepth === depth);
    if (entry) {
      return parseSizeToBytes(entry[1]);
    }
  }
  return Math.ceil(getStampTheoreticalBytes(depth) * MAX_UTILIZATION);
}
function getStampEffectiveBytesBreakpoints(encryption, erasureCodeLevel) {
  const map = /* @__PURE__ */ new Map();
  for (let depth = 17; depth < 35; depth++) {
    map.set(depth, getStampEffectiveBytes(depth, encryption, erasureCodeLevel));
  }
  return map;
}
function getDepthForSize(size, encryption, erasureCodeLevel) {
  if (encryption !== void 0 && erasureCodeLevel !== void 0) {
    const breakpoints = (encryption ? ENCRYPTION_ON_BREAKPOINTS : ENCRYPTION_OFF_BREAKPOINTS)[erasureCodeLevel];
    const entry = breakpoints?.find(([, effectiveVolume]) => size <= parseSizeToBytes(effectiveVolume));
    if (entry) {
      return entry[0];
    }
  } else {
    for (const [depth, effectiveVolume] of DEFAULT_EFFECTIVE_SIZE_BREAKPOINTS) {
      if (size <= parseSizeToBytes(effectiveVolume)) {
        return depth;
      }
    }
  }
  return 35;
}

// src/stamper/marshal.ts
function marshalStamp(signature, batchId, timestamp, index) {
  if (signature.length !== 65) {
    throw new Error("invalid signature length");
  }
  if (batchId.length !== 32) {
    throw new Error("invalid batch ID length");
  }
  if (timestamp.length !== 8) {
    throw new Error("invalid timestamp length");
  }
  if (index.length !== 8) {
    throw new Error("invalid index length");
  }
  return new Bytes(concatBytes(batchId, index, timestamp, signature));
}
function convertEnvelopeToMarshaledStamp(envelope) {
  return marshalStamp(
    envelope.signature.toUint8Array(),
    envelope.batchId.toUint8Array(),
    envelope.timestamp,
    envelope.index
  );
}

// src/stamper/stamper.ts
function stamp(signer, batchId, address, slot, timestampMs = Date.now()) {
  const privateKey = new PrivateKey(signer);
  const batch = new BatchId(batchId);
  const bucket = uint16ToNumber(address, "BE");
  const index = concatBytes(numberToUint32(bucket, "BE"), numberToUint32(slot, "BE"));
  const timestamp = numberToUint64(BigInt(timestampMs) * 1000000n, "BE");
  const signature = privateKey.sign(concatBytes(address, batch.toUint8Array(), index, timestamp));
  return {
    batchId: batch,
    index,
    issuer: privateKey.publicKey().address(),
    signature,
    timestamp
  };
}
var Stamper = class _Stamper {
  signer;
  batchId;
  buckets;
  depth;
  maxSlot;
  constructor(signer, batchId, buckets, depth) {
    this.signer = signer;
    this.batchId = batchId;
    this.buckets = buckets;
    this.depth = depth;
    this.maxSlot = 2 ** (depth - 16);
  }
  /**
   * Creates a fresh Stamper for a batch with no chunks stamped yet.
   */
  static fromBlank(signer, batchId, depth) {
    return new _Stamper(new PrivateKey(signer), new BatchId(batchId), new Uint32Array(65536), depth);
  }
  /**
   * Resumes a Stamper from a previously persisted bucket state (see {@link getState}).
   */
  static fromState(signer, batchId, buckets, depth) {
    return new _Stamper(new PrivateKey(signer), new BatchId(batchId), buckets, depth);
  }
  /**
   * Stamps a chunk address, automatically picking and reserving the next
   * free slot in its bucket. Throws once a bucket reaches its depth-derived capacity.
   */
  stamp(address, timestampMs) {
    const bucket = uint16ToNumber(address, "BE");
    const height = this.buckets[bucket];
    if (height >= this.maxSlot) {
      throw new Error("Stamper#stamp bucket is full");
    }
    this.buckets[bucket] = height + 1;
    return stamp(this.signer, this.batchId, address, height, timestampMs);
  }
  /**
   * Returns the live bucket-height state, for persisting and later resuming
   * via {@link fromState}.
   */
  getState() {
    return this.buckets;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BatchId,
  Bytes,
  ChunkBuilder,
  ChunkJoiner,
  ChunkSplitter,
  EthAddress,
  FeedIndex,
  Fork,
  Identifier,
  MAX_PAYLOAD_SIZE,
  MIN_PAYLOAD_SIZE,
  MantarayNode,
  PeerAddress,
  PrivateKey,
  PublicKey,
  REPLICAS_OWNER,
  Reference,
  Signature,
  Span,
  Stamper,
  Topic,
  TransactionId,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  approximateOverheadForRedundancyLevel,
  base32ToUint8Array,
  base64ToUint8Array,
  binaryToUint8Array,
  calculateChunkAddress,
  checksumEncode,
  commonPrefix,
  compressPublicKey,
  concatBytes,
  convertEnvelopeToMarshaledStamp,
  decodeRedundancyLevel,
  decryptChunk,
  encodeRedundancyLevel,
  encryptData,
  encryptSegments,
  encryptSpan,
  equals,
  getDepthForSize,
  getMaxShards,
  getParities,
  getRedundancyStat,
  getRedundancyStats,
  getStampEffectiveBytes,
  getStampEffectiveBytesBreakpoints,
  getStampTheoreticalBytes,
  getStampUsage,
  hexToUint8Array,
  indexOf,
  keccak256,
  makeContentAddressedChunk,
  makeEncryptedReplicas,
  makeErasureBatch,
  makeIntermediateChunkHandler,
  makeReplicas,
  makeSOCAddress,
  makeSingleOwnerChunk,
  marshalStamp,
  numberToUint16,
  numberToUint256,
  numberToUint32,
  numberToUint64,
  numberToUint8,
  partition,
  privateKeyToPublicKey,
  publicKeyFromCompressed,
  publicKeyToAddress,
  recoverPublicKey,
  referenceCount,
  rsDecode,
  rsEncode,
  signHash,
  signMessage,
  sliceBytes,
  stamp,
  uint16ToNumber,
  uint256ToNumber,
  uint32ToNumber,
  uint64ToNumber,
  uint8ArrayToBase32,
  uint8ArrayToBase64,
  uint8ArrayToBinary,
  uint8ArrayToHex,
  uint8ToNumber,
  unmarshalContentAddressedChunk,
  unmarshalSingleOwnerChunk,
  verifySignature,
  xorCypher
});
//# sourceMappingURL=index.cjs.map
