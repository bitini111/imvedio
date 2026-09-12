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