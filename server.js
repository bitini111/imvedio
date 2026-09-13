/* 绘光 · 零依赖本地静态服务器 + Agnes AI 同源代理
 * 用法：node server.js  →  http://localhost:8653
 * 双击 index.html 也可以直接打开（此时浏览器直连 Agnes，若遇 CORS 需使用本方式）。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8653;
const AGNES_ORIGIN = 'https://apihub.agnes-ai.com';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm'
};

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

async function proxy(req, res, targetUrl, body) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    const downstreamHeaders = {
      ...headers
    };
    const r = await fetch(targetUrl, {
      method: req.method,
      headers: downstreamHeaders,
      body: body || undefined
    });
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json' });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: '代理请求失败：' + e.message }));
  }
}

http.createServer(async (req, res) => {
  const rawUrl = req.url || '/';
  const url = new URL(rawUrl, 'http://localhost:' + PORT);
  const pathname = decodeURIComponent(url.pathname);
  const search = url.search; // 含 ?

  // —— 工作流文件列表 API ——
  if (pathname === '/api/workflows') {
    const modes = ['t2i', 'i2i', 't2v', 'i2v'];
    const result = {};
    for (const mode of modes) {
      const dir = path.join(ROOT, 'workflows', mode);
      try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        result[mode] = files;
      } catch (e) {
        result[mode] = [];
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // —— ComfyUI 输出文件列表 API ——
  if (pathname === '/api/comfyui/outputs') {
    const CF_ROOT = 'D:/Program Files/ComfyUI/ComfyUI';
    const OUT_DIR = path.join(CF_ROOT, 'output');
    const TEMP_DIR = path.join(CF_ROOT, 'temp');
    try {
      const allFiles = []
        .concat(fs.readdirSync(OUT_DIR).map(f => ({filename: f, dir: 'output'})))
        .concat(fs.readdirSync(TEMP_DIR).map(f => ({filename: f, dir: 'temp'})));
      const pngFiles = allFiles.filter(f => f.filename.match(/\.(png|jpg|jpeg)$/i));
      pngFiles.sort((a, b) => {
        const dirA = a.dir === 'temp' ? TEMP_DIR : OUT_DIR;
        const dirB = b.dir === 'temp' ? TEMP_DIR : OUT_DIR;
        const mA = fs.statSync(path.join(dirA, a.filename)).mtime;
        const mB = fs.statSync(path.join(dirB, b.filename)).mtime;
        return mB - mA;
      });
      const urls = pngFiles.slice(0, 10).map(f => {
        const q = 'filename=' + encodeURIComponent(f.filename) + '&type=' + f.dir;
        return 'http://127.0.0.1:8188/view?' + q;
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ outputs: urls }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // —— ComfyUI 连接检测 API ——
  if (pathname === '/api/comfyui-ping') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: '缺少 url 参数' }));
      return;
    }
    fetch(targetUrl.replace(/\/+$/, '') + '/system_stats')
      .then(function(r) { return r.ok ? { ok: true } : { ok: false }; })
      .then(function(d) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); })
      .catch(function() { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false })); });
    return;
  }

  // —— ComfyUI 历史 API ——
  if (pathname === '/api/comfyui-history') {
    fetch('http://127.0.0.1:8188/history')
      .then(function(r) { return r.json(); })
      .then(function(h) {
        // 按 create_time（任务创建时间）降序排列，最新的在前
        var entries = Object.keys(h).map(function(k) {
          return { id: k, data: h[k] };
        });
        entries.sort(function(a, b) {
          var timeA = a.data.status.messages && a.data.status.messages[0] ? a.data.status.messages[0][1].timestamp : 0;
          var timeB = b.data.status.messages && b.data.status.messages[0] ? b.data.status.messages[0][1].timestamp : 0;
          return timeB - timeA; // 降序：最新的在前
        });
        var history = entries.map(function(e) { return e.data; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ history: history }));
      })
      .catch(function(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });
    return;
  }

  // —— Agnes AI 同源代理 ——
  if (pathname.startsWith('/api/')) {
    let target;
    if (pathname === '/api/chat/completions') target = AGNES_ORIGIN + '/v1/chat/completions';
    else if (pathname === '/api/images/generations') target = AGNES_ORIGIN + '/v1/images/generations';
    else if (pathname === '/api/videos') target = AGNES_ORIGIN + '/v1/videos';
    else if (pathname === '/api/agnesapi') target = AGNES_ORIGIN + '/agnesapi' + search;
    else { res.writeHead(404); res.end('Not Found'); return; }

    let body;
    if (req.method === 'POST') body = await readBody(req).catch(() => '');
    proxy(req, res, target, body).catch((e) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: '代理异常：' + e.message }));
    });
    return;
  }

  // —— 静态文件 ——
  let filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (pathname === '/') filePath = path.join(ROOT, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 只有根路径才返回 index.html（SPA 支持）
      if (pathname === '/') {
        const idx = path.join(ROOT, 'index.html');
        fs.stat(idx, (e2, s2) => {
          if (e2 || !s2.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
          const body = fs.readFileSync(idx);
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(body);
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => {
  console.log('绘光 · 已在 http://localhost:' + PORT + ' 启动（Ctrl+C 退出）');
});
