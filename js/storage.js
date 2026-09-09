/* ============================================================
 * storage.js — 历史记录（IndexedDB）+ 生成配额（localStorage）
 * ============================================================ */
(function (global) {
  'use strict';

  var DB_NAME = 'halo_history';
  var DB_VER = 1;
  var STORE = 'records';
  var QUOTA_KEY = 'halo.quota';
  var QUOTA_LIMIT_KEY = 'halo.quota.limit';
  var DEFAULT_QUOTA = 1000;
  var DEFAULT_QUOTA_LIMIT = 1000;

  var _db = null;
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { reject(new Error('无法打开本地存储')); };
    });
  }

  function tx(db, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(STORE, mode);
      var store = t.objectStore(STORE);
      var out;
      try { out = fn(store); } catch (e) { reject(e); return; }
      t.oncomplete = function () {
        // getAll 这类读请求在 onsuccess 后才有结果，取 result 返回
        if (out && typeof out.result !== 'undefined') resolve(out.result);
        else resolve(out);
      };
      t.onerror = function () { reject(t.error || new Error('存储失败')); };
      t.onabort = function () { reject(new Error('存储被中止')); };
    });
  }

  var Store = {

    /* ---------- 配额 ---------- */
    getQuota: function () {
      var n = parseInt(localStorage.getItem(QUOTA_KEY), 10);
      if (!isFinite(n) || n < 0) return DEFAULT_QUOTA;
      return n;
    },
    setQuota: function (n) {
      localStorage.setItem(QUOTA_KEY, String(Math.max(0, n)));
    },
    getQuotaLimit: function () {
      var n = parseInt(localStorage.getItem(QUOTA_LIMIT_KEY), 10);
      if (!isFinite(n) || n < 1) return DEFAULT_QUOTA_LIMIT;
      return Math.max(1, n);
    },
    setQuotaLimit: function (n) {
      localStorage.setItem(QUOTA_LIMIT_KEY, String(Math.max(1, parseInt(n, 10))));
      // 如果当前用量超过新上限，自动对齐到上限（保留已用额度）
      var cur = Store.getQuota();
      var limit = Store.getQuotaLimit();
      if (cur > limit) Store.setQuota(limit);
    },

    /* ---------- 历史 ---------- */
    addRecord: function (rec) {
      return openDB().then(function (db) {
        return tx(db, 'readwrite', function (store) { store.put(rec); });
      });
    },
    getAll: function () {
      return openDB().then(function (db) {
        return tx(db, 'readonly', function (store) { return store.getAll(); });
      }).then(function (arr) {
        arr.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        return arr;
      }).catch(function () { return []; });
    },
    deleteRecord: function (id) {
      return openDB().then(function (db) {
        return tx(db, 'readwrite', function (store) { store.delete(id); });
      });
    },

    /* ---------- 工具 ---------- */
    pad: function (n) { return n < 10 ? '0' + n : '' + n; },
    fmtWhen: function (ts) {
      var d = new Date(ts);
      return d.getFullYear() + '-' + Store.pad(d.getMonth() + 1) + '-' + Store.pad(d.getDate()) + ' ' +
             Store.pad(d.getHours()) + ':' + Store.pad(d.getMinutes());
    },
    fmtDuration: function (sec) {
      if (!isFinite(sec) || sec < 0) return '--:--';
      sec = Math.round(sec);
      var m = Math.floor(sec / 60), s = sec % 60;
      return Store.pad(m) + ':' + Store.pad(s);
    },
    uid: function () {
      return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }
  };

  global.Store = Store;
})(window || globalThis);