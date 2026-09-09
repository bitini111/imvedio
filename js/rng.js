/* ============================================================
 * rng.js — 可复现的伪随机数工具
 * 保证同一提示词 + 参数，生成结果一致（对应真实模型"同一种子复现"）。
 * ============================================================ */
(function (global) {
  'use strict';

  // 字符串 -> 32 位哈希（xmur3）
  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  // mulberry32 —— 以 32 位整数为种子的快速随机数生成器
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 由一串文本派生出一个稳定的随机数生成器
  function seeded(text) {
    return mulberry32(hashString(String(text)));
  }

  // 工具：在区间内取随机数（用已实例化的 rng）
  function range(rng, min, max) { return min + rng() * (max - min); }
  function int(rng, min, max) { return Math.floor(range(rng, min, max + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  global.RNG = { hashString: hashString, seeded: seeded, range: range, int: int, pick: pick };
})(window || globalThis);