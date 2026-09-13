/* ============================================================
 * comfyui.js — ComfyUI 本地引擎客户端
 * 与本地 ComfyUI 通过 WebSocket 通信，workflows/ 目录存放 .json 工作流。
 * 此文件在 agnes.js 之前加载，确保 Agnes.comfyui 可用。
 * ============================================================ */
var ComfyUI = (function () {
  'use strict';

  var WORKFLOWS_DIR = 'workflows/';
  var WORKFLOW_FILES = {
    t2i: 't2i/z_image_turbo_example.json',
    i2i: 'i2i/image_to_image.json',
    t2v: 't2v/text_to_video.json',
    i2v: 'i2v/image_to_video.json'
  };

  /* ---------- 加载工作流 JSON ---------- */
  function loadWorkflow(mode, customPath) {
    var file = customPath || WORKFLOW_FILES[mode];
    if (!file) return null;
    // 如果路径已是完整路径（以 workflows/ 开头），不再重复拼接
    var fullPath = file.startsWith('workflows/') ? file : WORKFLOWS_DIR + file;
    return fetch(fullPath).then(function (r) {
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
    // 注入到所有文本节点（positive 和 negative prompt）
    var injected = false;
    for (var nodeId in workflow) {
      var node = workflow[nodeId];
      var inputs = node.inputs || {};
      if (inputs.text !== undefined) {
        // 第一个文本节点注入完整 prompt，后续节点注入空字符串（作为 negative prompt）
        if (!injected) {
          inputs.text = prompt;
          injected = true;
        } else {
          inputs.text = '';
        }
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

  /* ---------- 将工作流节点键转换为 UUID（ComfyUI API 要求） ---------- */
  function convertToUUIDKeys(workflow) {
    var result = {};
    var uuid = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    };
    // 保存原始键映射，用于替换引用
    var keyMap = {};
    for (var oldKey in workflow) {
      var newKey = uuid();
      keyMap[oldKey] = newKey;
      // 深拷贝并移除 _meta 等非 API 字段
      var node = JSON.parse(JSON.stringify(workflow[oldKey]));
      delete node._meta;
      result[newKey] = node;
    }
    // 递归替换节点间的引用
    function replaceRefs(obj) {
      if (Array.isArray(obj)) {
        // 检查是否是 [nodeId, index] 格式的引用
        if (obj.length === 2 && typeof obj[0] === 'string' && keyMap[obj[0]]) {
          return [keyMap[obj[0]], obj[1]];
        }
        // 否则递归处理数组元素
        return obj.map(function(item) {
          return replaceRefs(item);
        });
      }
      if (obj && typeof obj === 'object') {
        for (var key in obj) {
          if (Array.isArray(obj[key])) {
            obj[key] = replaceRefs(obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            replaceRefs(obj[key]);
          }
        }
      }
      return obj;
    }
    for (var newKey in result) {
      result[newKey].inputs = replaceRefs(result[newKey].inputs);
    }
    return result;
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
  function queueAndPoll(ws, promptObj, onProgress, comfyuiUrl) {
    return new Promise(function (resolve, reject) {
      var clientId = ws.url.split('clientId=')[1] || uid();
      var baseUrl = comfyuiUrl || 'http://127.0.0.1:8188';
      baseUrl = baseUrl.replace(/\/+$/, '');

      var promptId = null;
      var executed = false;

      // 通过 HTTP POST 提交任务，获取 prompt_id
      fetch(baseUrl + '/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptObj, client_id: clientId })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.prompt_id) {
          reject(new Error('提交失败：未获取到prompt_id'));
          return;
        }
        promptId = data.prompt_id;
        console.log('[ComfyUI] Submitted:', promptId.substring(0, 8));
        onProgress && onProgress({ progress: 0.05, phase: '任务已提交，等待处理…' });
      })
      .catch(function(e) {
        reject(new Error('提交失败：' + e.message));
      });

      var timer = setTimeout(function () {
        if (!executed) reject(new Error('ComfyUI 任务超时（120s）'));
      }, 120000);

      // 轮询检查任务状态
      var pollTimer = setInterval(function () {
        if (executed || !promptId) return;

        fetch('/api/comfyui-history')
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data.history || data.history.length === 0) return;

            // 查找当前提交的任务（从最新开始查找）
            var currentJob = null;
            for (var i = data.history.length - 1; i >= 0; i--) {
              var job = data.history[i];
              var msg = job.status && job.status.messages ? job.status.messages[0] : null;
              if (msg && msg[1] && msg[1].prompt_id === promptId) {
                currentJob = job;
                break;
              }
            }

            if (!currentJob) return;

            var statusStr = currentJob.status.status_str;

            // 发送进度更新
            if (statusStr === 'running' || statusStr === 'partial') {
              var msgs = currentJob.status.messages || [];
              for (var m = 0; m < msgs.length; m++) {
                if (msgs[m][0] === 'exec_start') {
                  onProgress && onProgress({ progress: 0.1, phase: '正在执行节点…' });
                } else if (msgs[m][0] === 'execution_progress') {
                  var p = msgs[m][1].value / msgs[m][1].max || 0;
                  onProgress && onProgress({ progress: 0.1 + p * 0.8, phase: '生成中 ' + Math.round(p * 100) + '%…' });
                }
              }
            }

            // 检查完成
            if (statusStr === 'success' && !executed) {
              executed = true;
              clearInterval(pollTimer);
              clearTimeout(timer);

              var allImages = [];
              for (var nodeId in currentJob.outputs) {
                if (currentJob.outputs[nodeId].images) {
                  allImages = allImages.concat(currentJob.outputs[nodeId].images);
                }
              }

              if (allImages.length) {
                var results = allImages.map(function (img) {
                  return baseUrl + '/view?' + buildViewQuery(img);
                });
                console.log('[ComfyUI] Generated', allImages.length, 'images');
                resolve(results);
              } else {
                reject(new Error('生成失败：未获取到图片输出'));
              }
            } else if (statusStr === 'error' && !executed) {
              executed = true;
              clearInterval(pollTimer);
              clearTimeout(timer);
              var errorMsg = '';
              var msgs = currentJob.status.messages || [];
              for (var m = 0; m < msgs.length; m++) {
                if (msgs[m][0] === 'execution_error') {
                  errorMsg = msgs[m][1].error || '未知错误';
                  break;
                }
              }
              reject(new Error('ComfyUI 执行出错：' + errorMsg));
            }
          })
          .catch(function(e) {
            console.error('[ComfyUI] Poll error:', e.message);
          });
      }, 1500);
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
      wf = convertToUUIDKeys(wf);
      return connect(loadConfig()).then(function (ws) {
        return queueAndPoll(ws, wf, opts.onProgress, loadConfig().comfyuiUrl).then(function (urls) {
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
      wf = convertToUUIDKeys(wf);
      return connect(loadConfig()).then(function (ws) {
        return queueAndPoll(ws, wf, opts.onProgress, loadConfig().comfyuiUrl).then(function (urls) {
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
