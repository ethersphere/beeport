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

// src/crypto/ecdsa.ts
import { secp256k1 as secp256k12 } from "@noble/curves/secp256k1.js";
function signMessage(message, privateKey) {
  const signature = secp256k12.sign(keccak256(message), privateKey, { prehash: false });
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
  const signature = secp256k12.sign(hashBytes, privateKey, { prehash: false });
  const v = signature.recovery === 0 ? 27n : 28n;
  return [signature.r, signature.s, v];
}
function recoverPublicKey(message, r, s, v) {
  const recovery = v === 27n ? 0 : 1;
  const signature = new secp256k12.Signature(r, s, recovery);
  const point = signature.recoverPublicKey(keccak256(message));
  return [point.x, point.y];
}
function verifySignature(message, publicKey, r, s) {
  const signatureBytes = new secp256k12.Signature(r, s).toBytes("compact");
  const publicKeyBytes = secp256k12.Point.fromAffine({ x: publicKey[0], y: publicKey[1] }).toBytes(true);
  return secp256k12.verify(signatureBytes, keccak256(message), publicKeyBytes, { prehash: false });
}
export {
  checksumEncode,
  compressPublicKey,
  keccak256,
  privateKeyToPublicKey,
  publicKeyFromCompressed,
  publicKeyToAddress,
  recoverPublicKey,
  signHash,
  signMessage,
  verifySignature
};
//# sourceMappingURL=index.js.map
