/* ============================================================
 * app.js — 绘光 · 应用控制器
 * 模式：文生图 t2i / 图生图 i2i / 文生视频 t2v / 图生视频 i2v
 * 引擎：Agnes AI（默认）或本地预览引擎（离线回退）
 * 多语言：zh / en / ja / ko / es / fr / de / pt
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- 多语言初始化 ---------- */
  var _lang = I18N.getLang();
  function setLang(code) {
    if (!I18N.setLang(code)) return;
    _lang = code;
    document.documentElement.lang = code === 'zh' ? 'zh-Hans' : code;
    // 更新语言按钮显示
    var langData = I18N.LANGUAGES.find(function (l) { return l.code === code; }) || I18N.LANGUAGES[0];
    $('#langFlag').textContent = langData.flag;
    $('#langCode').textContent = code === 'zh' ? '中' : code === 'en' ? 'EN' : code === 'ja' ? '日' : code === 'ko' ? '韩' : code.toUpperCase();
    // 更新激活状态
    $$('#langDropdown .lang-option').forEach(function (opt) {
      opt.classList.toggle('active', opt.getAttribute('data-lang') === code);
    });
    // 重新渲染所有动态文本
    _exampleOrder = {};       // 先清空示例缓存，确保读取当前语言
    renderModeSwitch();
    renderCreator();
    if (state.view === 'history') renderHistory();
    renderTopbar();
    renderStage();
    translateStatic();
    renderExamples();
    // 如果有弹窗打开，也更新
    if (!$('#settingsModal').classList.contains('is-hidden')) openSettings();
  }
  function toggleLangDropdown() {
    var dd = $('#langDropdown');
    var btn = $('#langBtn');
    dd.classList.toggle('open');
    btn.classList.toggle('open');
  }

  /* ---------- 文案与定义（使用当前语言）---------- */
  function getExamples() { return (I18N.D[_lang] || I18N.D['zh']).examples; }
  var EXAMPLES = getExamples();
  var STYLES = I18N.D['zh'].styleLabels;
  var STYLE_SUFFIX = {};
  I18N.D['zh'].styleSuffixes.forEach(function (s, i) { STYLE_SUFFIX[STYLES[i]] = s; });
  var CAMERAS = I18N.D['zh'].cameraLabels;
  var CAMERA_TAIL = {};
  I18N.D['zh'].cameraTails.forEach(function (c, i) { CAMERA_TAIL[CAMERAS[i]] = c; });
  var PLACEHOLDERS = {
    t2i: I18N.D['zh'].placeholderImage,
    i2i: I18N.D['zh'].placeholderImg2Img,
    t2v: I18N.D['zh'].placeholderVideo,
    i2v: I18N.D['zh'].placeholderImg2Vid
  };

  var MODES = {
    t2i: { label: '文生图', out: 'image', ratios: ['1:1', '4:3', '3:4', '2:3', '3:2', '16:9', '9:16', '自定义'], resolutions: ['1K', '2K', '3K', '4K'], defaultRes: '1K', needsImage: false, imageLimit: 0 },
    i2i: { label: '图生图', out: 'image', ratios: ['原图', '1:1', '4:3', '3:4', '2:3', '3:2', '16:9', '9:16', '自定义'], resolutions: ['1K', '2K', '3K', '4K'], defaultRes: '1K', needsImage: true, imageLimit: 1 },
    t2v: { label: '文生视频', out: 'video', ratios: ['16:9', '9:16', '1:1', '自定义'], durations: [5, 10], customDurMax: 12, needsImage: false, imageLimit: 0 },
    i2v: { label: '图生视频', out: 'video', ratios: ['原图', '16:9', '9:16', '1:1', '自定义'], durations: [5, 10], customDurMax: 12, needsImage: true, imageLimit: 5 }
  };
  // 分辨率 → 基准像素（1:1 时的宽）
  var RESOLUTION_PX = { '1K': 1024, '2K': 2048, '3K': 3072, '4K': 4096 };
  // 比例 → [w,h] 在基准分辨率下的尺寸
  var RATIO_SIZES = {
    '1:1': [1, 1], '4:3': [4, 3], '3:4': [3, 4],
    '2:3': [2, 3], '3:2': [3, 2], '16:9': [16, 9], '9:16': [9, 16]
  };
  // 视频比例 → [w,h]（720p 基准）
  var VIDEO_RATIO_SIZES = {
    '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1]
  };

  /* ---------- 状态 ---------- */
  var state = {
    view: 'create',
    mode: 't2i',
    prompt: '',
    images: [],            // 上传的参考图 [{name, src}]
    params: { ratio: '1:1', style: '写实', count: 1, duration: 5, camera: '静止',
      customRatioW: 1024, customRatioH: 1024, // 自定义比例时的宽/高
      customDuration: 5,                        // 自定义时长
      seed: '随机'                          // 种子：'随机' 或具体数字
    },
    config: Agnes.loadConfig(),
    generating: false,
    cancelReq: false,
    forceComfyUI: false,   // 单次强制 ComfyUI
    run: null,
    history: [],
    filter: 'all',
    quota: Store.getQuota(),
    quotaLimit: Store.getQuotaLimit(),
    lbIndex: 0,
    lbRun: null
  };
  // 确保配额持久化到 localStorage（迁移旧数据）
  state.quota = Store.getQuota();
  state.quotaLimit = Store.getQuotaLimit();
  Store.setQuota(state.quota);
  Store.setQuotaLimit(state.quotaLimit);

  var blobUrls = new Map();
  function blobUrl(b) {
    if (!blobUrls.has(b)) blobUrls.set(b, URL.createObjectURL(b));
    return blobUrls.get(b);
  }
  function revokeBlob(b) {
    if (blobUrls.has(b)) { URL.revokeObjectURL(blobUrls.get(b)); blobUrls.delete(b); }
  }

  /* ---------- 小工具 ---------- */
  function toast(msg, type) {
    var wrap = $('#toastWrap');
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    var dot = type === 'ok' ? '✓' : type === 'err' ? '✕' : '·';
    el.innerHTML = '<span class="dot">' + dot + '</span><span></span>';
    el.lastChild.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 2800);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ratioClass(ratio) {
    var map = { '16:9': 'ratio-16-9', '9:16': 'ratio-9-16', '4:3': 'aspect-4-3', '3:4': 'aspect-3-4', '3:2': 'aspect-3-2', '2:3': 'aspect-2-3' };
    return map[ratio] || '';
  }
  function fmtEta(ms) {
    if (!isFinite(ms) || ms < 0) return '';
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return '约 ' + s + ' 秒';
    var m = Math.floor(s / 60), r = s % 60;
    return m + ' 分 ' + r + ' 秒';
  }
  function m() { return MODES[state.mode]; }

  /* ---------- 原图比例：解析参考图尺寸，映射到最接近的可用比例 ---------- */
  var IMAGE_ASPECTS = ['1:1', '16:9', '9:16', '3:4', '4:3', '2:3', '3:2', '21:9'];
  var VIDEO_ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
  var _sizeCache = {};
  function dataUrlSize(src) {
    if (_sizeCache[src]) return Promise.resolve(_sizeCache[src]);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { _sizeCache[src] = { w: img.width, h: img.height }; resolve(_sizeCache[src]); };
      img.onerror = function () { reject(new Error('参考图尺寸读取失败')); };
      img.src = src;
    });
  }
  function yieldToUI() { return new Promise(function (r) { setTimeout(r, 0); }); }

  function ratioValue(ratio) {
    var p = String(ratio).split(':');
    return parseInt(p[0], 10) / parseInt(p[1], 10);
  }
  function nearestAspect(img, list) {
    if (!img || !img.w || !img.h) return '1:1';
    var a = img.w / img.h, best = list[0], bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var d = Math.abs(ratioValue(list[i]) - a);
      if (d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }
  function localSizeFor(run, out) {
    var w = run.originW, h = run.originH;
    if (!w || !h) return null;
    var maxLong = out === 'video' ? 1280 : 1024;
    var a = w / h;
    if (a >= 1) return [maxLong, Math.max(1, Math.round(maxLong / a))];
    return [Math.max(1, Math.round(maxLong * a)), maxLong];
  }
  function resolveOriginal(run) {
    // 用第一张参考图的比例；无图时兜底 1:1
    if (run.images && run.images.length) {
      return dataUrlSize(run.images[0]).then(function (sz) {
        run.originW = sz.w; run.originH = sz.h;
        var list = MODES[run.kind].out === 'image' ? IMAGE_ASPECTS : VIDEO_ASPECTS;
        run.effectiveRatio = nearestAspect(sz, list);
        run.size = localSizeFor(run, MODES[run.kind].out);
      });
    }
    run.effectiveRatio = '1:1';
    run.size = null;
    return Promise.resolve();
  }
  function effRatio(run) { return run.effectiveRatio || run.params.ratio || '1:1'; }

  /* ---------- 顶栏 ---------- */
  function renderTopbar() {
    var q = Store.getQuota(), ql = Store.getQuotaLimit();
    $('#quotaNum').textContent = q + '/' + ql;
    $('#quotaPill').classList.toggle('low', q <= Math.max(0, Math.min(ql, 5)));
    if (q === 0) $('#quotaPill').classList.add('zero');
    else $('#quotaPill').classList.remove('zero');
    $('#quotaPill').title = I18N.t('quotaLabel');
    var engineKey = state.config.engine === 'ai' ? 'engineAI' : 'engineComfyUI';
    if ($('#footEngine')) $('#footEngine').textContent = ' ' + I18N.t(engineKey);
  }
  function renderModeSwitch() {
    var modeMap = { t2i: 'navImage', i2i: 'navImg2Img', t2v: 'navVideo', i2v: 'navImg2Vid' };
    $$('#modeSwitch .mode-btn').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === state.mode));
      var mode = b.getAttribute('data-mode');
      var key = modeMap[mode];
      if (key && I18N.D[_lang] && I18N.D[_lang][key]) b.textContent = I18N.D[_lang][key];
    });
  }

  /* ---------- 创作面板 ---------- */
  function segHtml(items, group) {
    return items.map(function (v) {
      return '<button class="seg-btn" data-group="' + group + '" data-value="' + v + '">' + v + '</button>';
    }).join('');
  }
  function renderCreator() {
    var mm = m(), isImg = mm.out === 'image';
    var p = state.params;

    $('#promptLabel').textContent = I18N.t('labelPrompt');
    $('#promptInput').placeholder = PLACEHOLDERS[state.mode];
    $('#genLabel').textContent = isImg ? I18N.t('btnGenImage') : I18N.t('btnGenVideo');
    $('#genHint').textContent = I18N.t('hintGen');
    $('#optimizeBtn').innerHTML = I18N.t('labelOptimize');
    var examplesHead = document.querySelector('.examples-head');
    if (examplesHead) {
      examplesHead.innerHTML = '<span class="eyebrow">' + I18N.t('labelExamples') + '</span>' +
        '<button class="link-btn" id="shuffleExample" data-action="shuffle-example">' + I18N.t('btnShuffle') + '</button>';
    }

    // 分辨率档位（图片模式才显示；视频接口固定 720P，无此选项）
    var resList = mm.resolutions || ['1K'];
    var resEyebrow = document.querySelector('#resolutionGroup .eyebrow');
    if (resEyebrow) resEyebrow.textContent = I18N.t('labelRes');
    $('#resolutionSeg').innerHTML = resList.map(function (v) {
      return '<button class="seg-btn" data-group="resolution" data-value="' + v + '">' + v + '</button>';
    }).join('');
    // 视频模式不显示分辨率选择
    $('#resolutionGroup').classList.toggle('is-hidden', !isImg || state.config.engine === 'comfyui');

    // 比例
    var ratioEyebrow = document.querySelector('#ratioSeg').parentElement.querySelector('.eyebrow');
    if (ratioEyebrow) ratioEyebrow.textContent = I18N.t('labelRatio');
    $('#ratioSeg').innerHTML = segHtml(mm.ratios, 'ratio');
    // 风格（仅图片模式）
    var styleEyebrow = document.querySelector('#styleGroup .eyebrow');
    if (styleEyebrow) styleEyebrow.textContent = I18N.t('labelStyle');
    $('#styleSeg').innerHTML = segHtml(I18N.D[_lang].styleLabels, 'style');
    // 自定义比例时显示宽高输入
    var customRow = '<div class="param-group is-hidden" id="customRatioGroup">' +
      '<span class="eyebrow">' + I18N.t('labelCustom') + I18N.t('labelRatio') + '</span>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
        '<input type="number" class="sp-input" id="customW" value="' + p.customRatioW + '" min="256" max="8192" step="64" style="width:100px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elev);color:var(--text);font-size:13px;">' +
        '<span style="color:var(--text-2);font-size:13px">×</span>' +
        '<input type="number" class="sp-input" id="customH" value="' + p.customRatioH + '" min="256" max="8192" step="64" style="width:100px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elev);color:var(--text);font-size:13px;">' +
        '<span style="color:var(--text-3);font-size:11.5px">px</span>' +
      '</div>' +
    '</div>';
    // 在 params 容器后插入自定义行
    var paramsEl = document.querySelector('.params');
    var existing = document.querySelector('#customRatioGroup');
    if (!existing && paramsEl) paramsEl.insertAdjacentHTML('afterend', customRow);

    // 视频时长
    var countEyebrow = document.querySelector('#countGroup .eyebrow');
    if (countEyebrow) countEyebrow.textContent = I18N.t('labelCount');
        // 种子
    var seedInput = document.querySelector("#seedGroup");
    if (!seedInput) {
      var seedRow = '<div class="param-group" id="seedGroup">' +
        '<span class="eyebrow">' + I18N.t("labelSeed") + '</span>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input type="text" class="sp-input" id="seedInput" value="' + (p.seed || "随机") + '" placeholder="随机" maxlength="11" style="width:120px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elev);color:var(--text);font-size:13px;">' +
          '<span style="color:var(--text-3);font-size:11px">填数字锁定种子，留空/写随机则每次不同</span>' +
        '</div>' +
      '</div>';
      var countG = document.querySelector("#countGroup");
      if (countG) countG.insertAdjacentHTML("afterend", seedRow);
    } else {
      if (p.seed) seedInput.value = p.seed;
      else seedInput.value = "随机";
    }

    $('#countSeg').innerHTML = [1, 4].map(function (v) {
      var key = v === 1 ? 'imgCountOne' : 'imgCount';
      return '<button class="seg-btn" data-group="count" data-value="' + v + '">' + I18N.t(key, v) + '</button>';
    }).join('');

    $('#styleGroup').classList.toggle('is-hidden', !isImg || state.config.engine === 'comfyui');
    $('#countGroup').classList.toggle('is-hidden', !isImg);
    $('#durationGroup').classList.toggle('is-hidden', isImg);
    $('#seedGroup').classList.toggle('is-hidden', !isImg);
    $('#cameraGroup').classList.toggle('is-hidden', isImg);
    $('#resolutionGroup').classList.toggle('is-hidden', !isImg || state.config.engine === 'comfyui');

    if (mm.durations) {
      var dd = mm.durations.slice();
      // 添加自定义选项
      var maxDur = mm.customDurMax || 12;
      dd.push('自定义');
      var durEyebrow = document.querySelector('#durationGroup .eyebrow');
      if (durEyebrow) durEyebrow.textContent = I18N.t('labelDuration');
      $('#durationSeg').innerHTML = dd.map(function (v) {
        if (v === '自定义') return '<button class="seg-btn" data-group="duration" data-value="' + v + '">' + I18N.t('labelCustom') + '</button>';
        return '<button class="seg-btn" data-group="duration" data-value="' + v + '">' + (v >= 60 ? I18N.t('minLabel') : I18N.t('secLabel', v)) + '</button>';
      }).join('');
      // 自定义时长的输入
      var durCustomRow = '<div class="param-group is-hidden" id="customDurGroup">' +
        '<span class="eyebrow">' + I18N.t('labelDuration') + '</span>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<input type="number" class="sp-input" id="customDurInput" value="' + p.customDuration + '" min="1" max="' + maxDur + '" step="1" style="width:80px;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-elev);color:var(--text);font-size:13px;">' +
          '<span style="color:var(--text-3);font-size:11.5px">' + I18N.t('secLabel') + '（最大 ' + maxDur + 's）</span>' +
        '</div>' +
      '</div>';
      var existingDur = document.querySelector('#customDurGroup');
      var durGroup = document.querySelector('#durationGroup');
      if (!existingDur && durGroup) durGroup.insertAdjacentHTML('afterend', durCustomRow);

      // 相机
      var cameraEyebrow = document.querySelector('#cameraGroup .eyebrow');
      if (cameraEyebrow) cameraEyebrow.textContent = I18N.t('labelCamera');
      $('#cameraSeg').innerHTML = segHtml(I18N.D[_lang].cameraLabels, 'camera');
      // 默认时长适配
      if (dd.indexOf(p.duration) < 0 && p.duration !== '自定义') p.duration = dd[0];
    }

    // 高亮
    highlight('ratioSeg', 'ratio', p.ratio);
    highlight('resolutionSeg', 'resolution', p.resolution || mm.defaultRes);
    if (isImg) {
      highlight('styleSeg', 'style', p.style);
      highlight('countSeg', 'count', String(p.count));
      highlight('seedSeg', 'seed', p.seed || '随机');
    } else {
      highlight('durationSeg', 'duration', String(p.duration));
      highlight('cameraSeg', 'camera', p.camera);
    }

    // 显示/隐藏自定义控件
    var isCustomRatio = p.ratio === '自定义';
    var crg = $('#customRatioGroup');
    if (crg) crg.classList.toggle('is-hidden', !isCustomRatio);
    if (isCustomRatio) {
      if ($('#customW')) $('#customW').value = p.customRatioW;
      if ($('#customH')) $('#customH').value = p.customRatioH;
    }
    var isCustomDur = p.duration === '自定义';
    var cdg = $('#customDurGroup');
    if (cdg) cdg.classList.toggle('is-hidden', !isCustomDur);
    if (isCustomDur) {
      if ($('#customDurInput')) $('#customDurInput').value = p.customDuration;
    }

    // 上传区
    var up = $('#uploadPanel');
    up.classList.toggle('is-hidden', !mm.needsImage);
    if (mm.needsImage) {
      $('#uploadLabel').textContent = '参考图片（可 ' + (mm.imageLimit === 1 ? '1 张' : mm.imageLimit + ' 张') + '）';
      $('#uploadZoneText').textContent = mm.imageLimit === 1 ? '点击或拖拽上传 1 张' : '点击或拖拽上传（最多 ' + mm.imageLimit + ' 张）';
      $('#uploadHint').textContent = mm.out === 'video' ? '多张图片会依次作为画面参考（支持口述运镜与转场）' : '';
      renderUploads();
    }

    renderExamples();
  }

  function highlight(containerId, group, value) {
    $$('#' + containerId + ' [data-group="' + group + '"]').forEach(function (b) {
      var on = String(b.getAttribute('data-value')) === String(value);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  /* ---------- 示例词 ---------- */
  var _exampleOrder = {};
  function renderExamples() {
    var chips = $('#exampleChips');
    var arr = getExamples()[state.mode];
    if (!_exampleOrder[state.mode]) _exampleOrder[state.mode] = arr.slice();
    var list = _exampleOrder[state.mode];
    chips.innerHTML = list.map(function (t, i) {
      return '<button class="chip" data-action="use-example" data-index="' + i + '" title="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
    }).join('');
  }
  function shuffleExamples() {
    var arr = getExamples()[state.mode].slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    _exampleOrder[state.mode] = arr;
    renderExamples();
  }

  /* ---------- 上传 ---------- */
  function downscaleDataURL(file, maxW) {
    maxW = maxW || 1024;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, maxW / img.width);
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片无法读取')); };
      img.src = url;
    });
  }

  function addFiles(files) {
    var mm = m(), need = mm.imageLimit;
    if (!mm.needsImage) return;
    var list = [].slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
    if (!list.length) { toast('请选择图片文件', 'err'); return; }
    list.forEach(function (file) {
      if (state.images.length >= need) { toast('最多可上传 ' + need + ' 张图片', ''); return; }
      downscaleDataURL(file).then(function (dataURL) {
        if (state.images.length >= need) return;
        state.images.push({ name: file.name || '参考图', src: dataURL });
        renderUploads();
      }).catch(function () { toast('该图片无法读取', 'err'); });
    });
  }
  function renderUploads() {
    var box = $('#uploadThumbs');
    box.innerHTML = state.images.map(function (im, i) {
      return '<div class="thumb-item">' +
        '<img src="' + im.src + '" alt="参考图 ' + (i + 1) + '">' +
        '<button class="thumb-del" data-action="remove-upload" data-index="' + i + '" title="移除">✕</button>' +
      '</div>';
    }).join('');
    $('#uploadZone').classList.toggle('is-hidden', !!state.images.length);
  }
  function initUploads() {
    var zone = $('#uploadZone'), input = $('#fileInput');
    function openPicker() { input.click(); }
    zone.addEventListener('click', openPicker);
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openPicker(); });
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
    ['dragover', 'dragenter'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag'); });
    });
    zone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  }

  /* ---------- 舞台渲染 ---------- */
  function renderStage() {
    $('#createView').classList.toggle('is-hidden', state.view !== 'create');
    $('#historyView').classList.toggle('is-hidden', state.view !== 'history');
    if (state.view !== 'create') return;

    var stage = $('#stage');
    if (state.generating) { stage.innerHTML = emptyProgress(); return; }
    if (state.run) {
      if (state.run.status === 'error') { stage.innerHTML = errorPanel(state.run); return; }
      stage.innerHTML = resultPanel(state.run);
      mountResults(stage, state.run);
      return;
    }
    stage.innerHTML = emptyState();
  }

  function emptyState() {
    var mm = m();
    return (
      '<div class="stage-empty">' +
        '<div class="aperture"><span class="aperture-icon">✦</span></div>' +
        '<h2>' + I18N.t('emptyTitle') + '</h2>' +
        '<p>' + I18N.t('emptyDesc') + '</p>' +
        '<span class="cta-hint">' + I18N.t('emptyHint') + '</span>' +
      '</div>'
    );
  }

  function emptyProgress() {
    return (
      '<div class="gen-progress" id="genProgress">' +
        '<div class="progress-aura"><div class="aura-core">0%</div></div>' +
        '<p class="gen-phase" id="genPhase">' + I18N.t('phasePreparing') + '</p>' +
        '<p class="gen-eta" id="genEta"></p>' +
        '<div class="gen-bar"><i id="genBarFill"></i></div>' +
        '<button class="cancel-btn" data-action="cancel-gen">' + I18N.t('btnCancel') + '</button>' +
      '</div>'
    );
  }
  function paintProgress(run) {
    var bar = $('#genBarFill'), ph = $('#genPhase'), eta = $('#genEta'), core = $('.aura-core');
    if (!bar) return;
    var pc = Math.min(100, Math.round((run.progress || 0) * 100));
    bar.style.width = pc + '%';
    if (core) core.textContent = pc + '%';
    if (ph) ph.textContent = run.phase || '';
    if (eta) eta.textContent = run.eta || '';
  }

  function errorPanel(run) {
    return (
      '<div class="gen-progress">' +
        '<div class="progress-aura"><div class="aura-core" style="color:#ff8c98">!</div></div>' +
        '<p class="gen-phase">' + I18N.t('errTitle') + '</p>' +
        '<p class="gen-eta" style="font-family:inherit;color:var(--text-2);max-width:420px;line-height:1.6">' + escapeHtml(run.error || I18N.t('errDetail')) + '</p>' +
        '<div style="display:flex;gap:10px;margin-top:6px">' +
          '<button class="mini-btn primary" data-action="retry-gen">' + I18N.t('btnRetry') + '</button>' +
          '<button class="mini-btn" data-action="clear-run">' + I18N.t('btnClear') + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- 结果：媒体源 ---------- */
  function segSrc(run, i) {
    var seg = run.segments && run.segments[i];
    if (!seg) return null;
    if (seg.url) return seg.url;
    if (seg.blob) return blobUrl(seg.blob);
    return null;
  }
  function imgSrcs(run) {
    if (run.urls && run.urls.length) return run.urls;
    if (run.blobs && run.blobs.length) return run.blobs.map(blobUrl);
    return [];
  }

  function chipsOf(run) {
    var a = [];
    if (run.params.ratio === '自定义') {
      a.push(run.params.customRatioW + '×' + run.params.customRatioH);
    } else {
      a.push(run.params.ratio === '原图' ? '原图比例' : run.params.ratio);
    }
    if (run.params.resolution) a.push(run.params.resolution);
    if (run.params.style) a.push(run.params.style);
    if (run.params.count > 1) a.push(run.params.count + ' 张');
    if (run.params.seed && run.params.seed !== '随机') a.push('种子 ' + run.params.seed);
    if (run.params.duration) a.push(run.params.duration >= 60 ? '1 分钟' : run.params.duration + ' 秒');
    if (run.params.camera) a.push('运镜·' + run.params.camera);
    if (run.images && run.images.length) a.push(run.images.length + ' 张参考图');
    return a.map(function (t) { return '<span class="mini-chip">' + escapeHtml(t) + '</span>'; }).join('');
  }

  function resultPanel(run) {
    var isImg = MODES[run.kind].out === 'image';
    var rc = ratioClass(effRatio(run));
    if (isImg) {
      var srcs = imgSrcs(run);
      var cards = srcs.map(function (src, i) {
        return (
          '<div class="result-card ' + rc + '">' +
            '<img src="' + src + '" alt="生成图片 ' + (i + 1) + '">' +
            '<div class="card-hover">' +
              '<button class="hover-btn" data-action="zoom-item" data-index="' + i + '" title="放大预览">⤢</button>' +
              '<button class="hover-btn" data-action="download-item" data-index="' + i + '" title="下载图片">↓</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      return resultBar(run) +
        '<div class="results-grid' + (srcs.length > 1 ? ' quad' : '') + '">' + cards + '</div>';
    }
    // 视频：单段或多段播放器
    return resultBar(run) + playlistCard(run);
  }

  function resultBar(run) {
    var modeNavKey = { t2i: 'navImage', i2i: 'navImg2Img', t2v: 'navVideo', i2v: 'navImg2Vid' };
    return (
      '<div class="result-bar">' +
        '<div class="result-prompt">' +
          '<span class="kicker">' + I18N.t(modeNavKey[run.kind] || 'navImage') + '</span>' +
          '<span class="text">' + escapeHtml(run.prompt) + '</span>' +
          '<button class="copy-icon" data-action="copy-prompt" title="' + I18N.t('btnCopy') + '">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="result-params">' + chipsOf(run) + '</div>' +
        '<div class="result-actions">' +
          '<button class="mini-btn" data-action="remix-prompt">' + I18N.t('btnRemix') + '</button>' +
          '<button class="mini-btn primary" data-action="redo-run">' + I18N.t('btnRegen') + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function playlistCard(run, inLb) {
    var n = run.segments ? run.segments.length : 1;
    var rc = ratioClass(effRatio(run));
    var chips = n > 1
      ? '<div class="seg-chips">' + Array.from({ length: n }, function (_, i) {
          return '<button class="seg-chip" data-seg="' + i + '">片段 ' + (i + 1) + '</button>';
        }).join('') + '</div>'
      : '';
    var corner = inLb ? '' :
      '<div class="corner-actions">' +
        '<button class="hover-btn" data-action="zoom-item" data-index="0" title="放大预览">⤢</button>' +
        '<button class="hover-btn" data-action="download-video" title="下载视频">↓</button>' +
      '</div>';
    return (
      '<div class="result-card video-card ' + rc + (inLb ? ' in-lb' : '') + '" data-kind="video">' +
        '<video class="rv" playsinline preload="auto"></video>' +
        '<div class="seg-chips">' + chips + '</div>' +
        corner +
        '<div class="video-controls">' +
          '<button class="pause" data-action="toggle-play" aria-label="播放 / 暂停">▶</button>' +
          '<div class="vp"><b></b></div>' +
          '<span class="time">0:00 / 0:00</span>' +
        '</div>' +
      '</div>'
    );
  }

  function mountResults(container, run) {
    if (MODES[run.kind].out === 'video' || (run.segments && run.segments.length)) {
      var v = container.querySelector('video.rv');
      if (v) mountPlaylistPlayer(v.parentElement, run);
    }
  }

  /* ---------- 多段视频播放器 ---------- */
  function mountPlaylistPlayer(card, run) {
    var v = card.querySelector('video.rv');
    if (!v || v.dataset.mounted) return;
    v.dataset.mounted = '1';
    var sources = run.segments.map(function (_, i) { return segSrc(run, i); }).filter(Boolean);
    if (!sources.length) return;
    var n = sources.length, si = 0, durs = new Array(n).fill(null);
    var pauseBtn = card.querySelector('.pause');
    var barWrap = card.querySelector('.vp'), bar = barWrap.querySelector('b');
    var timeEl = card.querySelector('.time');
    var chips = card.querySelectorAll('.seg-chip');

    function segNominal(i) {
      var total = run.params.duration || 10;
      var segs = total <= 10 ? [total] : Array(total / 10).fill(10);
      return segs[i] || 10;
    }
    function fmt(sec) { return Store.fmtDuration(sec); }
    function refresh() {
      var d = v.duration && isFinite(v.duration) ? v.duration : segNominal(si);
      if (bar) bar.style.width = (v.currentTime / d * 100) + '%';
      if (timeEl) {
        var totalTxt = fmt(d) + (n > 1 ? ' · 片段' + (si + 1) + '/' + n : '');
        timeEl.textContent = fmt(v.currentTime) + ' / ' + totalTxt;
      }
    }
    function loadSeg(i, autoplay) {
      if (i < 0 || i >= n) return;
      si = i;
      v.src = sources[i];
      if (chips) chips.forEach(function (c, k) { c.classList.toggle('on', k === i); });
      refresh();
      if (autoplay) { v.play().catch(function () {}); if (pauseBtn) pauseBtn.textContent = '⏸'; }
      else { v.pause(); if (pauseBtn) pauseBtn.textContent = '▶'; }
    }
    function toggle() {
      if (v.paused) { v.play().catch(function () {}); pauseBtn.textContent = '⏸'; }
      else { v.pause(); pauseBtn.textContent = '▶'; }
    }

    v.addEventListener('loadedmetadata', function () { durs[si] = v.duration; refresh(); });
    v.addEventListener('timeupdate', refresh);
    v.addEventListener('ended', function () {
      if (si < n - 1) loadSeg(si + 1, true);
      else { pauseBtn.textContent = '▶'; v.currentTime = 0; bar.style.width = '0%'; }
    });
    pauseBtn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    v.addEventListener('click', function (e) { if (!e.target.closest('[data-action]')) toggle(); });
    barWrap.addEventListener('click', function (e) {
      var r = barWrap.getBoundingClientRect();
      var d = v.duration || segNominal(si);
      if (d) v.currentTime = (e.clientX - r.left) / r.width * d;
    });
    if (chips) chips.forEach(function (c) {
      c.addEventListener('click', function (e) { e.stopPropagation(); loadSeg(parseInt(c.getAttribute('data-seg'), 10), false); });
    });
    loadSeg(0, false);
  }

  /* ---------- 历史记录 ---------- */
  function renderHistory() {
    translateStatic();
    var grid = $('#historyGrid');
    var list = state.history.filter(function (r) {
      var kind = MODES[r.kind] ? MODES[r.kind].out : 'image';
      return state.filter === 'all' || kind === state.filter;
    });
    $$('#historyFilter [data-filter]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === state.filter));
    });
    if (!list.length) {
      grid.innerHTML =
        '<div class="history-empty">' +
          '<div class="em">🎨</div>' +
          '<h3>' + (state.history.length ? I18N.t('historyEmpty') : I18N.t('historyEmpty')) + '</h3>' +
          '<p>' + (state.history.length ? I18N.t('historyEmptyDesc') : I18N.t('historyEmptyDesc')) + '</p>' +
          '<button class="go-create" data-action="go-create">' + I18N.t('btnGoCreate') + '</button>' +
        '</div>';
      return;
    }
    grid.innerHTML = list.map(historyCardHtml).join('');
  }

  function historyCardHtml(r) {
    var kind = MODES[r.kind] ? MODES[r.kind].out : 'image';
    var isImg = kind === 'image';
    var src = isImg ? (imgSrcs(r)[0] || '') : (segSrc(r, 0) || '');
    var media = isImg
      ? '<img src="' + src + '" alt="">'
      : '<video src="' + src + '" muted playsinline preload="metadata"></video>';
    var modeNavKey = { t2i: 'navImage', i2i: 'navImg2Img', t2v: 'navVideo', i2v: 'navImg2Vid' };
    return (
      '<div class="history-card" data-action="open-detail" data-id="' + r.id + '">' +
        '<div class="thumb">' + media +
          '<span class="type-badge ' + r.kind + '">' + (isImg ? I18N.t('labelTypeImg') : I18N.t('labelTypeVideo')) + '</span>' +
          '<span class="mode-now">' + I18N.t(modeNavKey[r.kind] || 'navImage') + '</span>' +
        '</div>' +
        '<div class="meta">' +
          '<p class="hp">' + escapeHtml(r.prompt) + '</p>' +
          '<div class="row">' +
            '<span class="when">' + Store.fmtWhen(r.createdAt) + '</span>' +
            '<span class="acts">' +
              '<button data-action="regen-from-history" data-id="' + r.id + '" title="' + I18N.t('labelTipRegen') + '">↻</button>' +
              '<button class="del" data-action="delete-record" data-id="' + r.id + '" title="' + I18N.t('labelTipDelete') + '">✕</button>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- 灯箱 ---------- */
  function openLightbox(r) {
    var lb = $('#lightbox'), body = $('#lightboxBody');
    var kind = MODES[r.kind] ? MODES[r.kind].out : 'image';
    state.lbRun = r;
    if (kind === 'image') {
      var srcs = imgSrcs(r);
      var src = srcs[state.lbIndex] || srcs[0] || '';
      body.innerHTML =
        '<div class="lightbox-media"><img src="' + src + '"></div>' +
        '<div class="lightbox-foot"><div class="info">' +
          '<div class="fp-row"><span class="fp">' + escapeHtml(r.prompt) + '</span>' +
            '<button class="copy-icon lb-copy" data-action="lb-copy-prompt" title="' + I18N.t('btnCopy') + '">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="chips">' + chipsOf(r) + '</div></div>' +
          '<div class="acts">' +
            '<button class="mini-btn" data-action="lb-download">' + I18N.t('btnDownload') + '</button>' +
            '<button class="mini-btn primary" data-action="lb-regen">' + I18N.t('btnRegen') + '</button>' +
          '</div></div>';
    } else {
      // 灯箱：视频内嵌播放器
      var mediaBox = document.createElement('div');
      mediaBox.className = 'lightbox-media';
      mediaBox.innerHTML = playlistCard(r, true);
      body.appendChild(mediaBox);
      body.insertAdjacentHTML('beforeend',
        '<div class="lightbox-foot"><div class="info">' +
          '<div class="fp-row"><span class="fp">' + escapeHtml(r.prompt) + '</span>' +
            '<button class="copy-icon lb-copy" data-action="lb-copy-prompt" title="' + I18N.t('btnCopy') + '">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="chips">' + chipsOf(r) + '</div></div>' +
          '<div class="acts">' +
            '<button class="mini-btn" data-action="lb-download">' + I18N.t('btnDownloadVideo') + '</button>' +
            '<button class="mini-btn primary" data-action="lb-regen">' + I18N.t('btnRegen') + '</button>' +
          '</div></div>');
      var lv = mediaBox.querySelector('video.rv');
      if (lv) mountPlaylistPlayer(lv.parentElement, r);
    }
    lb.classList.remove('is-hidden');
  }
  function closeLightbox() {
    $('#lightbox').classList.add('is-hidden');
    $('#lightboxBody').innerHTML = '';
    state.lbRun = null;
    closeSettings();
  }

  /* ---------- 生成：编排 ---------- */
  function startGeneration(opts) {
    if (state.generating) return;
    opts = opts || {};
    var prompt = (opts.prompt != null ? opts.prompt : state.prompt).trim();
    if (!prompt) {
      toast('先描述一下你想要的画面吧', 'err');
      var box = $('.prompt-box');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      $('#promptInput').focus();
      return;
    }
    var mm = m();
    if (mm.needsImage && !state.images.length) {
      toast('请先上传参考图片', 'err');
      $('#uploadZone').focus();
      return;
    }
    if (Store.getQuota() <= 0) { toast('今日生成次数已用完（' + Store.getQuotaLimit() + ' 次/天）', 'err'); return; }

    var p = state.params;
    var run = {
      id: Store.uid(),
      kind: state.mode,
      prompt: prompt,
      params: {
        ratio: p.ratio,
        style: mm.out === 'image' ? p.style : undefined,
        count: mm.out === 'image' ? p.count : 1,
        duration: mm.out === 'video' ? (p.duration === '自定义' ? p.customDuration : p.duration) : undefined,
        camera: mm.out === 'video' ? p.camera : undefined,
        resolution: mm.resolutions ? p.resolution || mm.defaultRes : undefined,
        customRatioW: p.customRatioW,
        customRatioH: p.customRatioH,
        seed: p.seed || "随机"
      },
      images: state.images.map(function (i) { return i.src; }),
      status: 'generating',
      progress: 0, phase: '', eta: null,
      urls: [], blobs: [], segments: null
    };
    state.run = run;
    state.generating = true;
    state.cancelReq = false;
    state.forceComfyUI = !!opts.comfyui;
    setGenBtnLoading(true);
    renderStage();

    var useComfyUI = state.forceComfyUI || state.config.engine === 'comfyui';
    run._start = Date.now();
    run.effectiveRatio = run.params.ratio;
    run.size = null;
    var launch = function () {
      if (useComfyUI) runComfyUI(run);
      else runAI(run);
    };
    if (run.params.ratio === '原图') {
      resolveOriginal(run).then(launch).catch(function () {
        run.effectiveRatio = '1:1'; run.size = null;
        launch();
      });
    } else {
      launch();
    }
  }

  function setGenBtnLoading(on) {
    var b = $('#genBtn');
    b.classList.toggle('loading', on);
    b.disabled = on;
  }

  function composePrompt(run) {
    var p = run.prompt;
    var mm = MODES[run.kind];
    var useComfyUI = state.config.engine === 'comfyui' || state.forceComfyUI;
    if (mm.out === 'image') {
      if (!useComfyUI) {
        p = p + '，' + (STYLE_SUFFIX[run.params.style] || '');
        // 添加分辨率信息
        if (run.params.resolution && run.params.resolution !== '1K') {
          p = p + '，分辨率 ' + run.params.resolution;
        }
      }
      // 自定义比例
      if (run.params.ratio === '自定义' && run.params.customRatioW && !useComfyUI) {
        p = p + '，' + run.params.customRatioW + 'x' + (run.params.customRatioH || run.params.customRatioW);
      }
    } else {
      var tail = CAMERA_TAIL[run.params.camera] || '';
      if (tail) p = p + '，' + tail;
      if (mm.needsImage && run.images.length) {
        p = p + '。请以参考图内容为视觉主体，保持其主体特征并让画面自然动起来。';
        // 2.5-flash reference 模式用 <Picture N> 指代
        if (state.config.videoModel !== 'agnes-video-v2.0') {
          p = p + ' 参考图依次为 <Picture 1>' +
            (run.images.length > 1 ? '、<Picture 2>' + (run.images.length > 2 ? '、…<Picture ' + run.images.length + '>' : '') : '') + '。';
        }
      }
    }
    return p;
  }

  /* ============ AI 路径 ============ */
  var MAX_CONCURRENCY = 2;

  function runAI(run) {
    if (MODES[run.kind].out === 'image') runImagesAI(run);
    else runVideosAI(run);
  }

  function runImagesAI(run) {
    var n = run.params.count;
    var completed = 0;
    var failed = null;

    function processNext() {
      if (state.cancelReq) { abortQuiet(); return; }
      if (failed || completed >= n) {
        if (!state.cancelReq && !failed) completeRun(run);
        if (failed && !state.cancelReq) failRun(run, failed);
        return;
      }
      var idx = completed;
      Agnes.genImage({
        prompt: composePrompt(run),
        ratio: effRatio(run),
        style: run.params.style,
        images: run.images.length ? run.images : undefined,
        seed: run.params.seed && run.params.seed !== '随机' ? parseInt(run.params.seed, 10) : RNG.hashString(run.prompt + ':' + idx + ':' + Math.random()),
        resolution: run.params.resolution || '1K',
        customSize: run.params.ratio === '自定义' ? [run.params.customRatioW, run.params.customRatioH] : undefined
      }).then(function (url) {
        if (state.cancelReq) { abortQuiet(); return; }
        run.urls[idx] = url;
        completed++;
        run.progress = Math.min(0.96, completed / n);
        run.phase = n > 1 ? '正在生成图片（' + completed + '/' + n + '）…' : '正在生成图片…';
        paintProgress(run);
        renderStage(); // 实时渲染已完成的结果
        return yieldToUI();
      }).then(processNext).catch(function (err) {
        failed = err;
        processNext();
      });
    }
    processNext();
  }

  function runVideosAI(run) {
    var total = run.params.duration;
    var mm = MODES[run.kind];
    var maxSegDur = mm.customDurMax || 12; // 2.5-flash 最长 12s
    var segs = [];
    if (total <= maxSegDur) {
      segs = [total];
    } else {
      var nSegs = Math.ceil(total / maxSegDur);
      var remaining = total;
      for (var si = 0; si < nSegs; si++) {
        var segDur = Math.min(maxSegDur, remaining);
        segs.push(segDur);
        remaining -= segDur;
      }
    }
    var n = segs.length;
    run.segments = segs.map(function (dur, i) {
      return { dur: dur, idx: i, status: 'queued', progress: 0, url: null, error: null };
    });
    paintFromSegments(run);

    var queue = run.segments.slice();
    var active = 0;

    function processJob(dur) {
      var idx = dur.idx, seg = run.segments[idx];
      var withImgs = MODES[run.kind].needsImage && run.images.length ? run.images : undefined;
      Agnes.submitVideo({
        prompt: composePrompt(run),
        ratio: effRatio(run),
        duration: total,
        camera: run.params.camera,
        segDur: dur.dur,
        images: withImgs
      }).then(function (task) {
        seg.task = task;
        seg.status = 'in_progress';
        paintFromSegments(run);
        return pollVideoLoop(run, seg, idx, n);
      }).then(function (ok) {
        active--;
        startNext();
        if (state.cancelReq) { abortQuiet(); return; }
        if (ok.failed) { failRun(run, new Error(ok.error || '视频片段生成失败')); return; }
        if (allDone(run) && !state.cancelReq) {
          run.progress = 1; run.phase = '完成';
          completeRun(run);
        }
        return yieldToUI();
      }, function (err) {
        active--;
        startNext();
        if (state.cancelReq) { abortQuiet(); return; }
        failRun(run, err);
      });
    }

    function startNext() {
      while (active < MAX_CONCURRENCY && queue.length && !state.cancelReq) {
        active++;
        processJob(queue.shift());
      }
    }
    startNext();
  }

  function allDone(run) {
    return run.segments.every(function (s) { return s.status === 'completed'; });
  }

  function paintFromSegments(run) {
    var segs = run.segments || [], n = segs.length || 1;
    var sum = 0, doneN = 0, any = false;
    segs.forEach(function (s) {
      if (s.status === 'completed') { sum += 100; doneN++; }
      else if (s.progress) { sum += s.progress; any = true; }
      else if (s.status === 'in_progress' || s.status === 'queued') any = true;
    });
    run.progress = Math.min(0.97, sum / n / 100);
    run.phase = doneN === n ? '封装输出中…'
      : (doneN ? '已生成 ' + doneN + '/' + n + ' 段，正在生成第 ' + (doneN + 1) + ' 段…'
        : '正在生成视频片段 1/' + n + '…');
    var past = Date.now() - (run._start || Date.now());
    if (any) {
      run.eta = '已等待 ' + fmtEta(past) + '，预计还需 ' + fmtEta(Math.max(0, (n * 200000) * (1 - run.progress)));
    } else {
      run.eta = '任务排队中，预计需要几分钟';
    }
    paintProgress(run);
  }

  function pollVideoLoop(run, seg, idx, n) {
    var settle = { ok: false, failed: false, error: null };
    var tick = function () {
      if (state.cancelReq) return Promise.resolve(settle);
      return Agnes.pollVideo(seg.task).then(function (r) {
        seg.status = r.status;
        if (r.progress) seg.progress = r.progress;
        seg.error = r.error;
        paintFromSegments(run);
        if (r.status === 'completed' && r.url) {
          seg.url = r.url;
          seg.status = 'completed';
          paintFromSegments(run);
          settle.ok = true;
          return settle;
        }
        if (r.status === 'failed' || r.status === 'canceled' || r.status === 'cancelled') {
          settle.failed = true;
          settle.error = r.error || '视频生成失败';
          return settle;
        }
        if (state.cancelReq) return settle;
        return yieldToUI().then(tick);
      });
    };
    return tick();
  }

  /* ============ ComfyUI 路径 ============ */
  function runComfyUI(run) {
    if (MODES[run.kind].out === 'image') runImagesComfyUI(run);
    else runVideosComfyUI(run);
  }

  function runImagesComfyUI(run) {
    var n = run.params.count || 1;
    var completed = 0;
    var failed = null;

    function processNext() {
      if (state.cancelReq) { abortQuiet(); return; }
      if (failed || completed >= n) {
        if (!state.cancelReq && !failed) completeRun(run);
        if (failed && !state.cancelReq) failRun(run, failed);
        return;
      }
      ComfyUI.genImage({
        mode: run.kind === 'i2i' ? 'i2i' : 't2i',
        prompt: composePrompt(run),
        seed: run.params.seed && run.params.seed !== '随机' ? parseInt(run.params.seed, 10) : Math.floor(10000000000 + Math.random() * 90000000000),
        images: run.images.length ? run.images : [],
        workflowPath: ComfyUI.getCustomWorkflow(run.kind === 'i2i' ? 'i2i' : 't2i'),
        aspectRatio: state.config.engine === 'comfyui' ? undefined : effRatio(run),
        resolution: state.config.engine === 'comfyui' ? undefined : run.params.resolution,
        customSize: state.config.engine === 'comfyui' ? undefined : (run.params.ratio === '自定义' ? [run.params.customRatioW, run.params.customRatioH] : undefined),
        onProgress: function (p) {
          if (state.cancelReq) return;
          run.progress = Math.min(0.95, (completed + p.progress) / n);
          run.phase = n > 1 ? 'ComfyUI 生成中（' + (completed + 1) + '/' + n + '）…' : 'ComfyUI 生成中…';
          paintProgress(run);
        }
      }).then(function (result) {
        if (state.cancelReq) { abortQuiet(); return; }
        var urls = result.urls || [];
        urls.forEach(function (u, i) {
          if (completed + i < n) run.urls[completed + i] = u;
        });
        completed += urls.length || 1;
        renderStage();
        return yieldToUI().then(processNext);
      }).catch(function (err) {
        failed = err;
        processNext();
      });
    }
    processNext();
  }

  function runVideosComfyUI(run) {
    var total = run.params.duration;
    var mm = MODES[run.kind];
    run.phase = 'ComfyUI 准备中…';
    paintProgress(run);
    ComfyUI.genVideo({
      mode: run.kind === 'i2v' ? 'i2v' : 't2v',
      prompt: composePrompt(run),
      duration: total,
      seed: RNG.hashString(run.prompt + ':' + 0),
      images: run.images.length ? run.images : [],
      workflowPath: ComfyUI.getCustomWorkflow(run.kind === 'i2v' ? 'i2v' : 't2v'),
      onProgress: function (p) {
        if (state.cancelReq) return;
        run.progress = Math.min(0.95, p.progress);
        run.phase = p.phase || 'ComfyUI 生成中…';
        paintProgress(run);
      }
    }).then(function (result) {
      if (state.cancelReq) { abortQuiet(); return; }
      run.segments = (result.segments || []).map(function (s, i) {
        return { url: s.url || s, dur: total, idx: i, status: 'completed' };
      });
      if (!run.segments.length) {
        run.segments = [{ url: (result.urls && result.urls[0]) || null, dur: total, idx: 0, status: 'completed' }];
      }
      completeRun(run);
    }).catch(function (err) {
      if (state.cancelReq) return;
      failRun(run, err);
    });
  }

  /* ---------- 完成 / 失败 ---------- */
  function completeRun(run) {
    if (state.cancelReq) { abortQuiet(); return; }
    var ok = false;
    if (MODES[run.kind].out === 'image') ok = imgSrcs(run).length > 0;
    else ok = run.segments && run.segments.filter(function (s) { return s.url || s.blob; }).length > 0;
    if (!ok) { failRun(run, new Error('结果不完整，请重试')); return; }

    run.status = 'ok';
    run.createdAt = Date.now();
    state.quota = Math.max(0, state.quota - 1);
    Store.setQuota(state.quota);
    // 同步上限（防止上限被调低导致当前值超出）
    state.quotaLimit = Store.getQuotaLimit();

    var rec = {
      id: run.id,
      kind: run.kind,
      prompt: run.prompt,
      params: run.params,
      images: run.images,
      urls: run.urls && run.urls.length ? run.urls : undefined,
      blobs: run.blobs && run.blobs.length ? run.blobs : undefined,
      segments: run.segments ? run.segments.map(function (s) {
        return s.url ? { url: s.url, dur: s.dur } : { blob: s.blob, thumb: s.thumb, dur: s.dur };
      }) : undefined,
      createdAt: run.createdAt
    };
    Store.addRecord(rec).catch(function () {});
    state.history.unshift(rec);

    state.generating = false;
    state.cancelReq = false;
    setGenBtnLoading(false);
    renderTopbar();
    renderStage();
    if (state.view === 'history') renderHistory();
    toast((MODES[run.kind].out === 'image' ? '图片' : '视频') + '生成完成' +
      (state.config.engine === 'comfyui' ? '（ComfyUI）' : ''), 'ok');
  }

  function failRun(run, err) {
    state.generating = false;
    state.cancelReq = false;
    setGenBtnLoading(false);
    run.status = 'error';
    run.error = (err && err.message) || '出现未知错误';
    run.detail = err;
    renderStage();
  }
  function abortQuiet() {
    state.generating = false;
    state.cancelReq = false;
    setGenBtnLoading(false);
    state.run = null;
    renderStage();
    toast('已取消生成', '');
  }
  function cancelGeneration() {
    if (!state.generating) return;
    state.cancelReq = true;
  }

  /* ---------- 描述优化 ---------- */
  function doOptimize() {
    var text = state.prompt.trim();
    if (!text) { toast('先输入一段描述，再自动优化', ''); $('#promptInput').focus(); return; }
    var btn = $('#optimizeBtn');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = '优化中…';
    var hasImages = !!state.images.length;
    var p;
    if (state.config.engine === 'ai' && !state.forceComfyUI) {
      p = Agnes.optimizePrompt(text, hasImages);
    } else {
      p = Promise.resolve(localOptimize(text, state.mode));
    }
    p.then(function (out) {
      state.prompt = out;
      $('#promptInput').value = out;
      $('#promptCount').textContent = out.length + ' / 2048';
      toast('描述已优化', 'ok');
    }).catch(function (err) {
      toast('优化失败：' + ((err && err.message) || '网络错误'), 'err');
    }).finally(function () {
      btn.disabled = false;
      btn.innerHTML = old;
    });
  }

  function localOptimize(text, mode) {
    var deep = (state.images && state.images.length) ? '，参考图片保持主体特征' : '';
    var style = STYLE_SUFFIX[state.params.style] || '';
    var camera = MODES[mode].durations && state.params.camera && CAMERA_TAIL[state.params.camera]
      ? '，' + CAMERA_TAIL[state.params.camera] : '';
    return (text.replace(/[。，,\.\s]+$/, '') + '，高清画质，细节丰富，光影层次分明，构图讲究' +
      deep + (style ? '，' + style : '') + camera).slice(0, 2048);
  }

  /* ---------- 下载 / 复制 ---------- */
  function dl(a, filename) {
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(I18N.t('msgCopied'), 'ok'); }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(I18N.t('msgCopied'), 'ok'); } catch (e) { toast(I18N.t('msgCopyFailed'), 'err'); }
    ta.remove();
  }
  function downloadUrl(url, filename) {
    if (!url) return;
    if (url.slice(0, 5) === 'data:' || url.slice(0, 5) === 'blob:') {
      var a = document.createElement('a'); a.href = url; dl(a, filename); toast('已开始下载', 'ok');
      return;
    }
    fetch(url).then(function (r) { return r.ok ? r.blob() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (b) {
        var u = URL.createObjectURL(b);
        var a = document.createElement('a'); a.href = u; dl(a, filename);
        setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
        toast('已开始下载', 'ok');
      }).catch(function () { window.open(url, '_blank'); });
  }
  function stamp(r) { return new Date(r.createdAt || Date.now()).getTime(); }
  function downloadImage(r, idx) {
    downloadUrl(imgSrcs(r)[idx], '绘光_图片_' + stamp(r) + '.png');
  }
  function downloadVideo(r) {
    if (!r.segments || !r.segments.length) return;
    r.segments.forEach(function (s, i) {
      var src = s.url || (s.blob ? blobUrl(s.blob) : null);
      if (src) downloadUrl(src, '绘光_视频_片段' + (i + 1) + '_' + stamp(r) + (s.url && /\.mp4/.test(s.url) ? '.mp4' : '.webm'));
    });
    toast('开始下载全部片段', 'ok');
  }

  /* ---------- 事件 ---------- */
  function setPrompt(v) {
    state.prompt = v;
    $('#promptInput').value = v;
    $('#promptCount').textContent = v.length + ' / 2048';
  }

  function handleAction(act, e) {
    var action = act.getAttribute('data-action');
    var run = state.run, idx, id, rec;

    switch (action) {
      case 'use-example': {
        var i = parseInt(act.getAttribute('data-index'), 10);
        var list = _exampleOrder[state.mode] || EXAMPLES[state.mode];
        if (list[i]) { setPrompt(list[i]); $('#promptInput').focus(); }
        return;
      }
      case 'shuffle-example': shuffleExamples(); return;
      case 'optimize-prompt': doOptimize(); return;
      case 'cancel-gen': cancelGeneration(); return;
      case 'clear-run': state.run = null; renderStage(); return;
      case 'retry-gen': {
        var prev = state.run;
        state.run = null;
        state.generating = false;
        startGeneration({ prompt: prev.prompt });
        return;
      }
      case 'remix-prompt':
        if (run && run.prompt) { setPrompt(run.prompt); $('#promptInput').focus(); toast('已填入提示词，可以直接修改', ''); }
        return;
      case 'redo-run':
        if (run) {
          resetRunParams(run);
          startGeneration({ prompt: run.prompt });
        }
        return;
      case 'zoom-item':
        idx = parseInt(act.getAttribute('data-index'), 10) || 0;
        state.lbIndex = idx;
        openLightbox(run || nearestRun());
        return;
      case 'download-item':
        idx = parseInt(act.getAttribute('data-index'), 10) || 0;
        downloadImage(run || nearestRun(), idx);
        return;
      case 'download-video': downloadVideo(run || nearestRun()); return;
      case 'copy-prompt': copyText((run || nearestRun()).prompt); return;
      case 'lb-copy-prompt': copyText(state.lbRun ? state.lbRun.prompt : ''); return;
      case 'toggle-play': case 'seek': case 'set-mode': return;
      case 'open-history':
        if (state.view === 'history') { state.view = 'create'; renderStage(); $('#promptInput').focus(); return; }
        state.view = 'history'; renderStage(); renderHistory(); return;
      case 'back-to-create':
      case 'go-create': state.view = 'create'; renderStage(); $('#promptInput').focus(); return;
      case 'open-detail':
        id = act.getAttribute('data-id');
        rec = findRec(id);
        if (rec) { state.lbIndex = 0; openLightbox(rec); }
        return;
      case 'regen-from-history':
        id = act.getAttribute('data-id');
        rec = findRec(id);
        if (!rec) return;
        applyRecordToState(rec);
        setTimeout(function () {
          $('#promptInput').focus();
          $('#promptInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
        return;
      case 'remove-upload':
        idx = parseInt(act.getAttribute('data-index'), 10);
        state.images.splice(idx, 1);
        renderUploads();
        return;
      case 'delete-record':
        id = act.getAttribute('data-id');
        if (confirm('确定删除这条记录吗？')) {
          rec = findRec(id);
          if (rec) {
            (rec.blobs || []).forEach(revokeBlob);
            if (rec.segments) rec.segments.forEach(function (s) { if (s.blob) revokeBlob(s.blob); });
            Store.deleteRecord(id).catch(function () {});
          }
          state.history = state.history.filter(function (r2) { return r2.id !== id; });
          if (state.run && state.run.id === id) state.run = null;
          renderHistory();
          toast('已删除', '');
        }
        e.stopPropagation();
        return;
      case 'close-lightbox': closeLightbox(); return;
      case 'close-settings': closeSettings(); return;
      case 'lb-download':
        if (state.lbRun) {
          if (MODES[state.lbRun.kind].out === 'image') downloadImage(state.lbRun, state.lbIndex);
          else downloadVideo(state.lbRun);
        }
        return;
      case 'lb-regen':
        if (state.lbRun) {
          var lr = state.lbRun;
          closeLightbox();
          applyRecordToState(lr);
          startGeneration({ prompt: lr.prompt });
        }
        return;
    }
  }

  function nearestRun() { return state.run || state.lbRun; }
  function findRec(id) { return state.history.find(function (r) { return r.id === id; }); }

  function resetRunParams(run) {
    state.mode = run.kind;
    state.params.ratio = run.params.ratio || state.params.ratio;
    if (MODES[run.kind].out === 'image') {
      state.params.style = run.params.style || '写实';
      state.params.count = run.params.count || 1;
    } else {
      setEl('duration', run.params.duration || 5);
      setEl('camera', run.params.camera || '静止');
    }
    restoreImages(run);
    renderModeSwitch();
    renderCreator();
    renderStage();
  }
  function applyRecordToState(r) {
    state.view = 'create';
    state.prompt = r.prompt;
    setPrompt(r.prompt);
    resetRunParams(r);
  }
  function setEl(key, val) {
    if (key === 'duration') state.params.duration = val;
    else if (key === 'camera') state.params.camera = val;
  }
  function restoreImages(r) {
    if (r.images && r.images.length) {
      state.images = r.images.map(function (src, i) { return { name: '参考图' + (i + 1), src: src }; });
      renderUploads();
    }
  }

  function bind() {
    // 语言选择器
    $('#langBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleLangDropdown();
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#langSelector')) {
        $('#langDropdown').classList.remove('open');
        $('#langBtn').classList.remove('open');
      }
    });
    $('#langDropdown').addEventListener('click', function (e) {
      var opt = e.target.closest('.lang-option');
      if (!opt) return;
      var code = opt.getAttribute('data-lang');
      setLang(code);
      $('#langDropdown').classList.remove('open');
      $('#langBtn').classList.remove('open');
    });
    // 模式切换：无论是切换模式还是在历史页点击，都回到创作页
    $('#modeSwitch').addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]');
      if (!b || state.generating) return;
      var newMode = b.getAttribute('data-mode');
      if (newMode !== state.mode) {
        state.mode = newMode;
        var lim = m().imageLimit;
        if (lim && state.images.length > lim) state.images = state.images.slice(0, lim);
      }
      state.view = 'create';
      renderModeSwitch();
      renderCreator();
      renderStage();
    });
    $('#settingsBtn').addEventListener('click', openSettings);

    var ta = $('#promptInput');
    ta.addEventListener('input', function () {
      state.prompt = ta.value;
      $('#promptCount').textContent = ta.value.length + ' / 2048';
    });

    // 分发参数点击
    document.addEventListener('click', function (e) {
      var seg = e.target.closest('[data-group]');
      if (seg) {
        var group = seg.getAttribute('data-group'), val = seg.getAttribute('data-value');
        if (group === 'ratio') state.params.ratio = val;
        else if (group === 'style') state.params.style = val;
        else if (group === 'count') state.params.count = parseInt(val, 10);
        else if (group === 'seed') { state.params.seed = val.trim() || '随机'; }
        else if (group === 'duration') state.params.duration = val === '自定义' ? '自定义' : parseInt(val, 10);
        else if (group === 'camera') state.params.camera = val;
        else if (group === 'resolution') state.params.resolution = val;
        renderCreator();
        return;
      }

      // 自定义比例/时长输入
      if (e.target.id === 'customW' || e.target.id === 'customH') {
        state.params.customRatioW = parseInt($('#customW').value, 10) || 1024;
        state.params.customRatioH = parseInt($('#customH').value, 10) || 1024;
        return;
      }
      if (e.target.id === 'customDurInput') {
        var v = parseInt(e.target.value, 10);
        if (v >= 1 && v <= (MODES[state.mode]?.customDurMax || 12)) {
          state.params.customDuration = v;
        }
        return;
      }
      if (e.target.id === 'seedInput') {
        state.params.seed = e.target.value.trim() || '随机';
        return;
      }
      var act = e.target.closest('[data-action]');
      if (act) { handleAction(act, e); return; }
      if (e.target.id === 'lightbox') closeLightbox();
    }, true);

    $('#genBtn').addEventListener('click', function () { startGeneration(); });

    $('#lightbox').addEventListener('click', function (e) {
      if (e.target.id === 'lightbox') closeLightbox();
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeLightbox(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !state.generating && state.view === 'create') {
        e.preventDefault();
        startGeneration();
      }
    });

    initUploads();
    initSettings();
    $('#quotaAdd').addEventListener('click', function () {
      if (state.generating) return;
      var ql = Store.getQuotaLimit(), q = Store.getQuota();
      state.quotaLimit = ql; state.quota = q;
      var inc = 50;
      if (state.quota + inc > state.quotaLimit) inc = state.quotaLimit - state.quota;
      if (inc <= 0) { toast('已达到今日上限，请修改设置调整', 'err'); return; }
      state.quota += inc;
      Store.setQuota(state.quota);
      renderTopbar();
      toast('已补充 ' + inc + ' 次（当前上限：' + state.quotaLimit + '）', 'ok');
    });

    window.addEventListener('beforeunload', function () {
      blobUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    });
  }

  /* ---------- 设置弹窗 ---------- */
  function openSettings() {
    if (state.generating) return;
    var cfg = state.config;
    $('#apiKeyInput').value = cfg.apiKey;
    $('#quotaLimitInput').value = state.quotaLimit;
    $('#comfyuiUrlInput').value = cfg.comfyuiUrl || (ComfyUI.DEFAULT_URL || 'http://127.0.0.1:8188' || 'http://127.0.0.1:8188');
    _loadWorkflowSelects(cfg.engine === 'comfyui');
    if (cfg.engine === 'comfyui') checkComfyUIStatus();
    ['ai', 'comfyui'].forEach(function (v) {
      var el = $('#engineSeg [data-engine="' + v + '"]');
      if (el) {
        el.setAttribute('aria-checked', String(cfg.engine === v));
        el.setAttribute('aria-pressed', String(cfg.engine === v));
      }
    });
    // 显示/隐藏 ComfyUI URL 输入和工作流选择
    $('#comfyuiUrlGroup').classList.toggle('is-hidden', cfg.engine !== 'comfyui');
    $('#workflowFields').classList.toggle('is-hidden', cfg.engine !== 'comfyui');
    // AI 引擎时显示密钥/视频模型，ComfyUI 时隐藏
    $('#apiKeyField').classList.toggle('is-hidden', cfg.engine !== 'ai');
    $('#videoModelField').classList.toggle('is-hidden', cfg.engine !== 'ai');
    ['agnes-video-2.5-flash', 'agnes-video-v2.0'].forEach(function (v) {
      var el = $('#videoModelSeg [data-vmodel="' + v + '"]');
      if (el) el.setAttribute('aria-pressed', String(cfg.videoModel === v));
    });
    $('#settingsModal').classList.remove('is-hidden');
    // 翻译弹窗内容
    translateStatic();
  }
  function closeSettings() {
    $('#settingsModal').classList.add('is-hidden');
  }
  function checkComfyUIStatus() {
    var el = document.getElementById('comfyuiStatus');
    if (!el) return;
    var url = ($('#comfyuiUrlInput').value || '').trim() || ComfyUI.DEFAULT_URL;
    el.className = 'sp-status checking';
    el.textContent = '检测中…';
    fetch('/api/comfyui-ping?url=' + encodeURIComponent(url)).then(function(r) { return r.json(); }).then(function(d) {
      if (d.ok) { el.className = 'sp-status online'; el.textContent = '在线'; }
      else { el.className = 'sp-status offline'; el.textContent = '离线'; }
    }).catch(function() { el.className = 'sp-status offline'; el.textContent = '离线'; });
  }

  function _loadWorkflowSelects(populate) {
    ComfyUI.loadWorkflowOptions().then(function (options) {
      if (populate) ComfyUI.populateWorkflowSelects(options);
      ['t2i', 'i2i', 't2v', 'i2v'].forEach(function (mode) {
        var sel = document.getElementById('workflow' + mode.toUpperCase());
        if (sel) sel.value = ComfyUI.getCustomWorkflow(mode) || '';
      });
    }).catch(function (e) {
      console.error('加载工作流列表失败:', e.message);
    });
  }

  // ComfyUI URL 输入框变化时实时检测状态
  (function() {
    var _ct;
    var input = document.getElementById('comfyuiUrlInput');
    if (!input) return;
    input.addEventListener('input', function() {
      clearTimeout(_ct);
      _ct = setTimeout(checkComfyUIStatus, 600);
    });
  })();
  function initSettings() {
    $('#settingsModal').addEventListener('click', function (e) {
      if (e.target.id === 'settingsModal') closeSettings();
    });
    $('#engineSeg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-engine]');
      if (!b) return;
      state.config.engine = b.getAttribute('data-engine');
      ['ai', 'comfyui'].forEach(function (v) {
        var el = $('#engineSeg [data-engine="' + v + '"]');
        if (el) {
          el.setAttribute('aria-checked', String(v === state.config.engine));
          el.setAttribute('aria-pressed', String(v === state.config.engine));
        }
      });
      // 根据引擎显示/隐藏相关字段
      $('#comfyuiUrlGroup').classList.toggle('is-hidden', state.config.engine !== 'comfyui');
      $('#workflowFields').classList.toggle('is-hidden', state.config.engine !== 'comfyui');
      $('#apiKeyField').classList.toggle('is-hidden', state.config.engine !== 'ai');
      $('#videoModelField').classList.toggle('is-hidden', state.config.engine !== 'ai');
      // 切换到 ComfyUI 时实时刷新工作流列表
      if (state.config.engine === 'comfyui') { _loadWorkflowSelects(true); checkComfyUIStatus(); }
      renderTopbar();
      renderCreator();
    });
    $('#videoModelSeg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vmodel]');
      if (!b) return;
      state.config.videoModel = b.getAttribute('data-vmodel');
      ['agnes-video-2.5-flash', 'agnes-video-v2.0'].forEach(function (v) {
        var el = $('#videoModelSeg [data-vmodel="' + v + '"]');
        if (el) el.setAttribute('aria-pressed', String(v === state.config.videoModel));
      });
    });
    $('#quotaLimitInput').addEventListener('input', function () {
      var v = parseInt(this.value, 10);
      if (!isNaN(v) && v >= 1) Store.setQuotaLimit(v);
      state.quotaLimit = Store.getQuotaLimit();
      renderTopbar();
    });
    $('#saveCfgBtn').addEventListener('click', function () {
      var k = $('#apiKeyInput').value.trim();
      if (k) state.config.apiKey = k;        // 空输入 = 保留原密钥
      var limit = parseInt($('#quotaLimitInput').value, 10);
      if (!isNaN(limit) && limit >= 1) {
        Store.setQuotaLimit(limit);
        state.quotaLimit = Store.getQuotaLimit();
        state.quota = Store.getQuota();
        Store.setQuota(state.quota);
      }
      var url = ($('#comfyuiUrlInput').value || '').trim();
      if (url) state.config.comfyuiUrl = url;
      // 保存自定义工作流路径
      ['t2i', 'i2i', 't2v', 'i2v'].forEach(function (mode) {
        var sel = $('#workflow' + mode.toUpperCase());
        if (sel) state.config['workflow_' + mode] = sel.value || undefined;
      });
      Agnes.saveConfig(state.config);
      renderTopbar();
      toast('设置已保存', 'ok');
      closeSettings();
    });
    $('#testConnBtn').addEventListener('click', function () {
      var cfg = state.config;
      cfg.apiKey = $('#apiKeyInput').value.trim();
      var url = ($('#comfyuiUrlInput').value || '').trim();
      if (url) cfg.comfyuiUrl = url;
      Agnes.saveConfig(cfg);
      var btn = this;
      btn.disabled = true;
      var oldTxt = btn.textContent;
      btn.textContent = '测试中…';
      var doTest;
      if (cfg.engine === 'comfyui') {
        doTest = ComfyUI.testConnection();
      } else {
        doTest = Agnes.testConnection();
      }
      doTest.then(function (t) {
        toast((cfg.engine === 'comfyui' ? 'ComfyUI' : 'AI') + ' 连接正常，返回："' + t + '"', 'ok');
      }).catch(function (err) {
        toast('连接失败：' + ((err && err.message) || '请检查设置与网络'), 'err');
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = oldTxt;
      });
    });
  }

  function renderHistoryFilterWrapper() {
    $('#historyFilter').addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      state.filter = b.getAttribute('data-filter');
      renderHistory();
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    bind();
    renderHistoryFilterWrapper();
    renderModeSwitch();
    renderCreator();
    renderTopbar();
    translateStatic();
    renderStage();
    Store.getAll().then(function (list) {
      state.history = list;
      if (state.view === 'history') renderHistory();
    });
  }

  function translateStatic() {
    $$('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var text = I18N.t(key);
      if (text) el.textContent = text;
    });
  }

  init();
})();