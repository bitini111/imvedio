/* ============================================================
 * agnes.js — Agnes AI 接口客户端
 * 文本 / 文生图 / 图生图 / 文生视频 / 图生视频。
 * 认证：Authorization: Bearer <apiKey>
 * 直连失败（CORS / 网络）时，自动退回同源代理 /api/*（见 server.js），
 * 文件被 node server.js 服务即可自动使用。
 * ============================================================ */
(function (global) {
  'use strict';

  var API_BASE = 'https://apihub.agnes-ai.com/v1';
  var DEFAULT_KEY = 'sk-A7zJ8xNw2WYDxEeSfBvyF5jlNOFN0DhHROqHv3WdbR55sxBy';

  var DEFAULT_CONFIG = {
    engine: 'ai',                        // 'ai' | 'local'
    apiKey: DEFAULT_KEY,
    videoModel: 'agnes-video-2.5-flash', // 'agnes-video-2.5-flash' | 'agnes-video-v2.0'
    textModel: 'agnes-2.5-flash',
    imageModel: 'agnes-image-2.5-flash'
  };

  /* ---------- 配置持久化 ---------- */
  function loadConfig() {
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('halo.config') || '{}'); } catch (e) {}
    for (var k in DEFAULT_CONFIG) if (!(k in cfg)) cfg[k] = DEFAULT_CONFIG[k];
    return cfg;
  }
  function saveConfig(cfg) {
    localStorage.setItem('halo.config', JSON.stringify(cfg));
  }

  /* ---------- 底层请求：直连 → 同源代理 ---------- */
  function parseErrText(txt) {
    try {
      var j = JSON.parse(txt);
      if (j.detail) return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      if (j.error) return j.error.message || j.error || JSON.stringify(j.error);
    } catch (e) {}
    return txt ? String(txt).slice(0, 300) : '未知错误';
  }

  function req(method, path, query, body, timeoutMs) {
    var cfg = loadConfig();
    var qs = query ? '?' + Object.keys(query).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]);
    }).join('&') : '';
    var headers = { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' };
    var opts = { method: method, headers: headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    if (timeoutMs) {
      opts.signal = AbortSignal.timeout(timeoutMs);
    }

    // 1) 直连
    return fetch(API_BASE + path + qs, opts).then(function (r) {
      return r.text().then(function (txt) {
        if (!r.ok) throw new ApiError('服务端返回 ' + r.status + '：' + parseErrText(txt));
        try { return JSON.parse(txt); } catch (e) { return txt; }
      });
    }).catch(function (err) {
      if (err && err.handled) throw err;
      // CORS / 网络错误（TypeError 或 AbortError 超时）→ 走同源代理
      var onProxyOk = location.protocol === 'http:' || location.protocol === 'https:';
      if (!onProxyOk) { throw err; }
      return fetch('/api' + path + qs, {
        method: method, headers: headers, body: opts.body,
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs + 15000) : undefined
      }).then(function (r) {
        return r.text().then(function (txt) {
          if (!r.ok) throw new ApiError('代理返回 ' + r.status + '：' + parseErrText(txt));
          try { return JSON.parse(txt); } catch (e) { return txt; }
        });
      });
    });
  }

  function ApiError(message) { this.message = message; this.handled = true; }

  /* ---------- 文本 ---------- */
  function chat(messages, opts) {
    opts = opts || {};
    return req('POST', '/chat/completions', null, {
      model: loadConfig().textModel,
      messages: messages,
      temperature: opts.temperature != null ? opts.temperature : 0.7,
      max_tokens: opts.max_tokens || 1200
    }, opts.timeout || 80000).then(function (j) {
      var msg = j && j.choices && j.choices[0] && j.choices[0].message;
      var content = msg && msg.content;
      // 该模型默认带推理过程，偶发 content 为空时重试一次更长预算
      if (!content || !String(content).trim()) throw new ApiError('文本模型没有返回内容，请重试或增大长度');
      return String(content).trim();
    });
  }

  function optimizePrompt(text, hasImages) {
    var sys = [
      '你是一名专业的 AI 图片/视频创作提示词优化师。',
      '用户会给一段简短描述，请把它扩写成更具画面感的提示词：',
      '包含主体的细节、构图、光线、色调、氛围' + (hasImages ? '、以及参考素材如何运用' : '') + '。',
      '直接输出优化后的提示词本身，不要任何前缀、解释或引号，控制在 200 字以内，使用中文。'
    ].join('');
    return chat([
      { role: 'system', content: sys },
      { role: 'user', content: text }
    ], { temperature: 0.8, max_tokens: 1500 }).then(function (t) {
      return t.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    });
  }

  /* ---------- 图片生成 ---------- */
  function genImage(params) {
    // params: { prompt, ratio, style, images: [dataURI|url], seed?, resolution?, customSize? }
    var body = {
      model: loadConfig().imageModel,
      prompt: params.prompt,
      size: params.resolution || '1K',
      ratio: params.ratio,
      extra_body: { response_format: 'url' }
    };
    // 自定义尺寸
    if (params.customSize && params.customSize.length === 2) {
      body.size = params.customSize[0] + 'x' + params.customSize[1];
    }
    if (params.images && params.images.length) body.extra_body.image = params.images;
    if (params.seed != null) body.seed = Math.abs(params.seed) % 1000;

    return req('POST', '/images/generations', null, body, 300000).then(function (j) {
      var url = j && j.data && j.data[0] && (j.data[0].url || j.data[0].b64_json);
      if (!url) throw new ApiError('图片接口未返回结果');
      if (j.data[0].b64_json) return 'data:image/png;base64,' + url;
      return url;
    });
  }

  /* ---------- 视频：提交 + 轮询 ---------- */
  var RATIO_WH = {
    '16:9': [1152, 768], '9:16': [768, 1152], '1:1': [1024, 1024],
    '4:3': [1024, 768], '3:4': [768, 1024], '21:9': [1344, 576]
  };
  function framesFor(seconds) {
    // v2.0 采用 8n + 1 规则，24fps
    return Math.min(441, Math.max(9, Math.round(seconds * 24 + 1)));
  }
  function segDuration(total) { return total <= 10 ? total : 10; }

  function submitVideo(params) {
    // params: { prompt, duration, ratio, camera, images:[dataURI], segDur }
    var cfg = loadConfig();
    var isV2 = cfg.videoModel === 'agnes-video-v2.0';
    var body, modeName;

    if (isV2) {
      var wh = RATIO_WH[params.ratio] || [1152, 768];
      body = {
        model: cfg.videoModel,
        prompt: params.prompt,
        width: wh[0],
        height: wh[1],
        num_frames: framesFor(params.segDur),
        frame_rate: 24
      };
      modeName = 'agnes-video-v2.0';
      if (params.images && params.images.length) {
        if (params.images.length === 1) {
          body.image = params.images[0];
          body.mode = 'ti2vid';
        } else {
          body.extra_body = { image: params.images, mode: 'keyframes' };
        }
      }
    } else {
      body = {
        model: cfg.videoModel,
        prompt: params.prompt,
        mode: (params.images && params.images.length) ? 'reference' : 'text',
        seconds: String(params.segDur),
        size: '720P',
        aspect_ratio: params.ratio || '16:9',
        n: 1
      };
      modeName = cfg.videoModel;
      if (params.images && params.images.length) body.images = params.images.slice(0, 5);
    }

    return req('POST', '/videos', null, body, 60000).then(function (j) {
      if (!j || (!j.video_id && !j.task_id && !j.id)) throw new ApiError('视频任务创建失败，未返回任务ID');
      return {
        video_id: j.video_id, task_id: j.task_id || j.id,
        model: modeName, status: j.status || 'queued', progress: j.progress || 0
      };
    });
  }

  function pollVideo(task) {
    var query = { video_id: task.video_id || task.task_id };
    // 2.5-flash 的 reference/keyframe 查询必须带 model_name；v2.0 用纯 video_id
    if (task.model && task.model !== 'agnes-video-v2.0') query.model_name = task.model;
    return req('GET', '/agnesapi', query, undefined, 30000).then(function (j) {
      var status = j.status || 'queued';
      var url;
      if (j.metadata && j.metadata.url) url = j.metadata.url;
      else if (j.url) url = j.url;
      else if (j.video_url) url = j.video_url;
      else if (j.data && j.data[0]) url = j.data[0].url;
      return {
        status: status,
        progress: typeof j.progress === 'number' ? j.progress : (status === 'completed' ? 100 : 0),
        url: url,
        error: j.error || (j.detail && typeof j.detail === 'string' ? j.detail : null)
      };
    });
  }

  /* ---------- 连接测试 ---------- */
  function testConnection() {
    return chat([
      { role: 'user', content: '请只回复两个字：正常' }
    ], { max_tokens: 200, timeout: 45000 });
  }

  global.Agnes = {
    API_BASE: API_BASE,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    chat: chat,
    optimizePrompt: optimizePrompt,
    genImage: genImage,
    submitVideo: submitVideo,
    pollVideo: pollVideo,
    segDuration: segDuration,
    testConnection: testConnection
  };
})(window || globalThis);