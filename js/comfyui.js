/* ============================================================
 * comfyui.js — ComfyUI 本地引擎客户端
 * 与本地 ComfyUI 通过 WebSocket 通信，workflows/ 目录存放 .json 工作流。
 * 此文件在 agnes.js 之前加载，确保 Agnes.comfyui 可用。
 * ============================================================ */
var ComfyUI = (function () {
  'use strict';

  var WORKFLOWS_DIR = 'workflows/';
  var WORKFLOW_FILES = {
    t2i: 't2i/text_to_image.json',
    i2i: 'i2i/image_to_image.json',
    t2v: 't2v/text_to_video.json',
    i2v: 'i2v/image_to_video.json'
  };

  /* ---------- 加载工作流 JSON ---------- */
  function loadWorkflow(mode, customPath) {
    var file = customPath || WORKFLOW_FILES[mode];
    if (!file) return null;
    return fetch(file).then(function (r) {
      if (!r.ok) throw new Error('无法加载工作流 ' + file + '（HTTP ' + r.status + '）');
      return r.json();
    });
  }

  /* ---------- 获取自定义工作流路径 ---------- */
  function getCustomWorkflow(mode) {
    try {
      var cfg = JSON.parse(localStorage.getItem('halo.config') || '{}');
      return cfg['workflow_' + mode] || null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- 保存自定义工作流路径 ---------- */
  function saveCustomWorkflow(mode, path) {
    try {
      var cfg = JSON.parse(localStorage.getItem('halo.config') || '{}');
      if (path) {
        cfg['workflow_' + mode] = path;
      } else {
        delete cfg['workflow_' + mode];
      }
      localStorage.setItem('halo.config', JSON.stringify(cfg));
    } catch (e) {}
  }

  /* ---------- 加载工作流列表（通过 /api/workflows） ---------- */
  var _workflowCache = {};
  function loadWorkflowOptions() {
    if (Object.keys(_workflowCache).length > 0) return Promise.resolve(_workflowCache);
    return fetch('/api/workflows').then(function (r) {
      if (!r.ok) throw new Error('获取工作流列表失败 (HTTP ' + r.status + ')');
      return r.json();
    }).then(function (data) {
      _workflowCache = data;
      return data;
    });
  }

  function populateWorkflowSelects(options) {
    var modeMap = { t2i: 'workflowT2I', i2i: 'workflowI2I', t2v: 'workflowT2V', i2v: 'workflowI2V' };
    for (var mode in options) {
      var selId = modeMap[mode];
      if (!selId) continue;
      var sel = document.getElementById(selId);
      if (!sel) continue;
      var current = sel.value;
      sel.innerHTML = '<option value="">使用默认</option>';
      options[mode].forEach(function (file) {
        var opt = document.createElement('option');
        opt.value = 'workflows/' + mode + '/' + file;
        opt.textContent = file;
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
    }
  }

  /* ---------- 替换工作流中的 prompt（正向文本） ---------- */
  function injectPrompt(workflow, prompt, hasImage) {
    for (var nodeId in workflow) {
      var node = workflow[nodeId];
      var inputs = node.inputs || {};
      if (inputs.text !== undefined) {
        inputs.text = prompt;
        break;
      }
    }
    return workflow;
  }

  /* ---------- 替换 seed 并注入参考图（图生图 / 图生视频） ---------- */
  function injectSeedAndImage(workflow, seed, imgDataUrl, mode) {
    for (var nodeId in workflow) {
      var node = workflow[nodeId];
      var inputs = node.inputs || {};
      if (inputs.seed !== undefined && typeof inputs.seed === 'number') {
        inputs.seed = seed;
      }
    }
    if (imgDataUrl && (mode === 'i2i' || mode === 'i2v')) {
      var base64 = imgDataUrl.split(',')[1] || imgDataUrl;
      for (var id in workflow) {
        var n = workflow[id];
        if (n.class_type === 'LoadImage') {
          n.inputs.image = base64;
          n.inputs.upload = 'image';
          break;
        }
      }
    }
    return workflow;
  }

  /* ---------- 与 ComfyUI 建立 WebSocket 连接 ---------- */
  var DEFAULT_URL = 'http://127.0.0.1:8188';

  /* ---------- 本地配置读取（独立于 agnes.js） ---------- */
  function loadConfig() {
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('halo.config') || '{}'); } catch (e) {}
    cfg.comfyuiUrl = cfg.comfyuiUrl || DEFAULT_URL;
    return cfg;
  }

  function connect(cfg) {
    var baseUrl = cfg.comfyuiUrl || DEFAULT_URL;
    var protocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    var host = baseUrl.replace(/^https?:\/\//, '');
    return new Promise(function (resolve, reject) {
      var ws = new WebSocket(protocol + '://' + host + '/ws?clientId=' + uid());
      ws.onerror = function () { reject(new Error('无法连接 ComfyUI：' + baseUrl)); };
      ws.onopen = function () { resolve(ws); };
      setTimeout(function () { reject(new Error('连接 ComfyUI 超时（10s）')); }, 10000);
    });
  }

  var _connId = 0;
  function uid() { return 'agg-' + Date.now() + '-' + (++_connId); }

  /* ---------- 提交任务并轮询，返回结果 URL ---------- */
  function queueAndPoll(ws, promptObj, onProgress) {
    return new Promise(function (resolve, reject) {
      var clientId = ws.url.split('clientId=')[1] || uid();
      ws.send(JSON.stringify({ type: 'prompt', prompt: promptObj, client_id: clientId }));

      var timer = setTimeout(function () {
        reject(new Error('ComfyUI 任务超时（120s）'));
      }, 120000);

      var handler = function (evt) {
        try {
          var data = JSON.parse(evt.data);
        } catch (e) { return; }
        if (!data.type) return;

        switch (data.type) {
          case 'status':
            if (data.data && data.data.status && data.data.status.exec_info) {
              onProgress && onProgress({ progress: 0, phase: '任务已入队，等待 ComfyUI 处理…' });
            }
            break;
          case 'exec_start':
            onProgress && onProgress({ progress: 0.02, phase: '正在执行节点…' });
            break;
          case 'executing':
            if (data.data.node === null) {
              onProgress && onProgress({ progress: 0.1, phase: '生成中…' });
            } else {
              onProgress && onProgress({ progress: 0.1, phase: '节点 ' + data.data.node + ' 执行中…' });
            }
            break;
          case 'executed':
            var output = data.data.output || {};
            var images = output.images || [];
            if (images.length) {
              var baseUrl = ws.url.match(/:\/\/([^\/]+)/)[1];
              var results = images.map(function (img) {
                return baseUrl + '/view?' + buildViewQuery(img);
              });
              resolve(results);
              ws.close();
            }
            break;
          case 'progress':
            var p = data.data.value / data.data.max || 0;
            onProgress && onProgress({ progress: 0.1 + p * 0.8, phase: '生成中 ' + Math.round(p * 100) + '%…' });
            break;
          case 'execution_error':
            clearTimeout(timer);
            reject(new Error('ComfyUI 执行出错：' + (data.data.error || '未知错误')));
            ws.close();
            break;
        }
      };

      ws.addEventListener('message', handler);

      setTimeout(function () {
        ws.removeEventListener('message', handler);
        clearTimeout(timer);
        if (!ws.closed) reject(new Error('ComfyUI 响应超时'));
      }, 120000);
    });
  }

  function buildViewQuery(img) {
    var q = 'filename=' + encodeURIComponent(img.filename);
    if (img.subfolder) q += '&subfolder=' + encodeURIComponent(img.subfolder);
    q += '&type=' + (img.type || 'output');
    return q;
  }

  /* ---------- 对外 API ---------- */
  function genImage(opts) {
    opts = opts || {};
    var mode = opts.mode || 't2i';
    var customPath = opts.workflowPath || getCustomWorkflow(mode);
    return loadWorkflow(mode, customPath).then(function (wf) {
      wf = injectPrompt(JSON.parse(JSON.stringify(wf)), opts.prompt, !!opts.images.length);
      wf = injectSeedAndImage(wf, opts.seed, opts.images && opts.images.length ? opts.images[0] : null, mode);
      return connect(loadConfig()).then(function (ws) {
        return queueAndPoll(ws, wf, opts.onProgress).then(function (urls) {
          return { urls: urls };
        });
      });
    });
  }

  function genVideo(opts) {
    opts = opts || {};
    var mode = opts.mode || 't2v';
    var customPath = opts.workflowPath || getCustomWorkflow(mode);
    return loadWorkflow(mode, customPath).then(function (wf) {
      wf = injectPrompt(JSON.parse(JSON.stringify(wf)), opts.prompt, false);
      wf = injectSeedAndImage(wf, opts.seed, opts.images && opts.images.length ? opts.images[0] : null, mode);
      return connect(loadConfig()).then(function (ws) {
        return queueAndPoll(ws, wf, opts.onProgress).then(function (urls) {
          return { urls: urls, segments: urls.map(function (u, i) {
            return { url: u, dur: opts.duration || 10, idx: i };
          }) };
        });
      });
    });
  }

  function testConnection() {
    return connect(loadConfig()).then(function (ws) {
      return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () {
          ws.close();
          reject(new Error('ComfyUI 连接超时'));
        }, 8000);
        var handler = function (evt) {
          try { var d = JSON.parse(evt.data); } catch (e) { return; }
          if (d.type === 'status') {
            clearTimeout(timeout);
            var info = d.data && d.data.status && d.data.status.cmdline;
            ws.close();
            resolve(info || 'ComfyUI 连接正常');
          }
        };
        ws.addEventListener('message', handler);
      });
    }).catch(function (e) {
      throw new Error('ComfyUI 连接失败：' + e.message);
    });
  }

  return {
    genImage: genImage,
    genVideo: genVideo,
    testConnection: testConnection,
    loadWorkflow: loadWorkflow,
    getCustomWorkflow: getCustomWorkflow,
    saveCustomWorkflow: saveCustomWorkflow,
    loadWorkflowOptions: loadWorkflowOptions,
    populateWorkflowSelects: populateWorkflowSelects,
    DEFAULT_URL: DEFAULT_URL
  };
})();
