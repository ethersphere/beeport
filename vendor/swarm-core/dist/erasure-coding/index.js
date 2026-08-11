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

// src/chunk/byte-cursor.ts
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
export {
  approximateOverheadForRedundancyLevel,
  decodeRedundancyLevel,
  encodeRedundancyLevel,
  getMaxShards,
  getParities,
  getRedundancyStat,
  getRedundancyStats,
  makeErasureBatch,
  makeIntermediateChunkHandler,
  referenceCount,
  rsDecode,
  rsEncode
};
//# sourceMappingURL=index.js.map
