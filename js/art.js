/* ============================================================
 * art.js — 本地生成引擎
 *
 * 这一层是"生成器"的唯一出口。真实的文生图/文生视频模型接入时，
 * 只需把 generateImage / generateVideo 的内部替换成对 AI 服务的请求，
 * 上层 UI 与历史记录完全不用改。
 *
 * 当前实现：
 *  - 图片：由提示词 + 风格 + 比例 派生种子，用 Canvas 程序化绘制一幅
 *    风格化画面（渐变天空、天体、大气光斑、山脊/城市剪影、粒子、颗粒、调色）。
 *  - 视频：逐帧驱动同样的场景 + 镜头运动，经 captureStream + MediaRecorder
 *    真实编码为可播放、可下载的 WebM 文件。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 画布尺寸 ---------- */
  var IMAGE_RATIOS = { '1:1': [1024, 1024], '16:9': [1344, 768], '9:16': [768, 1344] };
  var VIDEO_RATIOS = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1024, 1024] };

  /* ---------- 色板：每种风格一组情绪 ---------- */
  var PALETTES = {
    '写实': [
      { sky: ['#2a3a52', '#6e8298', '#d7b48f'], cloud: '#f4c78e', far: '#4a5f73', near: '#1d2731', glow: '#ffcf9e', celestial: 'sun',  rays: false, stars: true },
      { sky: ['#1b2a3d', '#4a3f5c', '#c96f62'], cloud: '#ffb27d', far: '#31404e', near: '#162028', glow: '#ff8e6a', celestial: 'sun',  rays: false, stars: true },
      { sky: ['#0e1526', '#233b5e', '#caa1a1'], cloud: '#ffd9a0', far: '#3a3a55', near: '#1e1e2c', glow: '#ffe2a8', celestial: 'moon', rays: false, stars: true },
      { sky: ['#0f1c2e', '#3d5b78', '#9db8c9'], cloud: '#e8ecf2', far: '#4c6b7e', near: '#2b4254', glow: '#dcecf0', celestial: 'sun',  rays: true,  stars: false }
    ],
    '动漫': [
      { sky: ['#2c1a4d', '#b7417e', '#ff9e4f'], cloud: '#ffd9a0', far: '#5c3357', near: '#241a33', glow: '#ffcc66', celestial: 'sun',  rays: true,  stars: true },
      { sky: ['#3a6ff0', '#7fb5ff', '#cfe8ff'], cloud: '#ffffff', far: '#3f9ad1', near: '#2a6fae', glow: '#fff7d9', celestial: 'sun',  rays: true,  stars: false },
      { sky: ['#0b1030', '#2b2f6e', '#6f3f9e'], cloud: '#ff7ad9', far: '#2a2a52', near: '#101026', glow: '#ff5fd2', celestial: 'moon', rays: false, stars: true },
      { sky: ['#7ec8e3', '#b9e8d8', '#f5f0c1'], cloud: '#ffffff', far: '#63b978', near: '#3a8a52', glow: '#ffffcc', celestial: 'sun',  rays: true,  stars: false }
    ],
    '电影感': [
      { sky: ['#06222e', '#0d3d4e', '#f27d3d'], cloud: '#ff9a5a', far: '#123845', near: '#071b22', glow: '#ff8a3d', celestial: 'sun',  rays: false, stars: true },
      { sky: ['#123141', '#7a4a2e', '#f0a45c'], cloud: '#ffd9b0', far: '#3f3327', near: '#191510', glow: '#ffbe6b', celestial: 'sun',  rays: true,  stars: false },
      { sky: ['#041018', '#0d2c44', '#37688c'], cloud: '#a8d4ff', far: '#123448', near: '#061420', glow: '#b8e4ff', celestial: 'moon', rays: false, stars: true },
      { sky: ['#2a1a33', '#7a2f4d', '#e88a5d'], cloud: '#ffb78c', far: '#3a2334', near: '#1d1020', glow: '#ff9e63', celestial: 'sun',  rays: true,  stars: false }
    ],
    '插画': [
      { sky: ['#ffd9db', '#ffe9c9', '#fff3e0'], cloud: '#ffffff', far: '#f2b0ac', near: '#dd8c97', glow: '#fff7e0', celestial: 'sun',  rays: true,  stars: false },
      { sky: ['#dff3e4', '#eef7ee', '#ffffff'], cloud: '#ffffff', far: '#a3ccac', near: '#7aa98c', glow: '#fff9e3', celestial: 'sun',  rays: true,  stars: false },
      { sky: ['#e6e0f7', '#f4ecfb', '#fff7fd'], cloud: '#ffffff', far: '#c2b2e8', near: '#9480c9', glow: '#fff1ff', celestial: 'moon', rays: true,  stars: true },
      { sky: ['#c9f0e8', '#e3f6f1', '#fbfefd'], cloud: '#ffffff', far: '#8cd8c6', near: '#5ebba6', glow: '#fffbe8', celestial: 'sun',  rays: true,  stars: false }
    ],
    '3D': [
      { sky: ['#12122b', '#332a6b', '#7b4a9e'], cloud: '#c9b8ff', far: '#2b2360', near: '#141233', glow: '#ffd9ff', celestial: 'orbit', rays: false, stars: true },
      { sky: ['#0b1a24', '#12303f', '#1d5c5c'], cloud: '#8ff1e0', far: '#14464d', near: '#0a2326', glow: '#a4ffe9', celestial: 'orbit', rays: false, stars: true },
      { sky: ['#1a1208', '#4a3016', '#8a5a1e'], cloud: '#ffd9a0', far: '#4a3a1e', near: '#1e140a', glow: '#ffe9ad', celestial: 'orbit', rays: false, stars: false },
      { sky: ['#0d0d24', '#2e1352', '#6b2f8e'], cloud: '#ff9ae0', far: '#312060', near: '#120824', glow: '#b3ff7d', celestial: 'orbit', rays: false, stars: true }
    ]
  };

  var TERRAIN = ['ridge', 'dune', 'blocks', 'liquid'];
  var CAMERA = {
    '静止': function (t) { return { z: 1.015, r: 0, tx: 0, ty: 0 }; },
    '推进': function (t) { return { z: 1.02 + 0.24 * t, r: 0, tx: 0, ty: 0 }; },
    '拉远': function (t) { return { z: 1.26 - 0.24 * t, r: 0, tx: 0, ty: 0 }; },
    '环绕': function (t) { return { z: 1.04 + 0.03 * Math.sin(t * Math.PI), r: (t - 0.5) * 0.3, tx: 0, ty: 0 }; },
    '跟随': function (t) { return { z: 1.05, r: 0, tx: (t - 0.5) * 0.09, ty: (0.5 - Math.abs(t - 0.5)) * 0.02 }; }
  };

  /* ---------- 小工具 ---------- */
  function c2(hex) {
    hex = hex.replace('#', '');
    return [0, 2, 4].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
  }
  function rgba(hex, a) {
    var p = c2(hex);
    return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
  }
  function luma(hex) {
    var p = c2(hex);
    return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255;
  }

  /* ---------- 场景构建 ---------- */
  function buildScene(seedTxt, style, ratio) {
    var rng = RNG.seeded(seedTxt);
    var pool = PALETTES[style] || PALETTES['写实'];
    var pal = pool[Math.floor(rng() * pool.length)];

    var scene = {
      pal: pal,
      style: style,
      celestial: {
        type: pal.celestial,
        x: 0.18 + rng() * 0.64,
        y: style === '3D' ? 0.24 + rng() * 0.2 : 0.17 + rng() * 0.26,
        r: 0.05 + rng() * 0.035,
        hue: pal.glow
      },
      terrainType: TERRAIN[Math.floor(rng() * TERRAIN.length)],
      blobs: [], stars: [], parts: []
    };

    // 大气光斑
    var nBlob = 4 + Math.floor(rng() * 3);
    for (var i = 0; i < nBlob; i++) {
      scene.blobs.push({
        x: rng(), y: rng() * 0.75,
        r: 0.12 + rng() * 0.22,
        c: rng() < 0.5 ? pal.cloud : pal.sky[1],
        a: 0.06 + rng() * 0.1,
        dx: 0.5 + rng(), sp: 0.15 + rng() * 0.5
      });
    }

    // 星光
    var wantStars = pal.stars !== false || luma(pal.sky[0]) < 0.4;
    if (wantStars) {
      var nStar = 90 + Math.floor(rng() * 110);
      for (var s = 0; s < nStar; s++) {
        scene.stars.push({ x: rng(), y: rng() * 0.85, r: 0.001 + rng() * 0.0028, ph: rng() * 6.28, tw: 0.4 + rng() * 1.2 });
      }
    }

    // 漂浮粒子
    var nPart = style === '3D' ? 26 : 16 + Math.floor(rng() * 16);
    for (var p = 0; p < nPart; p++) {
      scene.parts.push({
        x: rng(), y: rng(),
        r: 0.0018 + rng() * 0.0042,
        c: rng() < 0.6 ? pal.glow : pal.cloud,
        ph: rng() * 6.28, sp: 0.35 + rng() * 1.1, amp: 0.015 + rng() * 0.03,
        vy: 0.004 + rng() * 0.01
      });
    }

    // 地形：预生成轮廓点（动画期间保持不变）
    var terrainRng = RNG.seeded(seedTxt + ':terrain');
    scene.ridge = buildRidge(terrainRng, scene.terrainType, pal);
    return scene;
  }

  function buildRidge(rng, type, pal) {
    var seg = 20, pts = [], baseH = 0.5 + rng() * 0.18;
    var amp = 0.1 + rng() * 0.16;
    var w1 = 0.5 + rng() * 1.2, a1 = rng() * 6.28, w2 = 1.6 + rng() * 2.4, a2 = rng() * 6.28;
    for (var i = 0; i <= seg; i++) {
      var u = i / seg, y;
      var s1 = 0.5 + 0.5 * Math.sin(u * 6.28 * w1 + a1);
      var s2 = 0.5 + 0.5 * Math.sin(u * 6.28 * w2 + a2);
      if (type === 'dune') y = baseH + 0.5 * s1 * amp + 0.3 * s2 * amp * 0.5;
      else y = baseH + s1 * amp + 0.5 * s2 * amp * 0.6;
      pts.push({ x: u, y: Math.min(y, 0.9) });
    }
    return { far: pts.slice(), near: pts.map(function (p) { return { x: p.x, y: Math.min(p.y + 0.07, 0.96) }; }),
             farCol: pal.far, nearCol: pal.near, type: type, baseH: baseH };
  }

  /* ---------- 绘制（单位坐标空间 0..1，调用前需 ctx.scale(W,H)） ---------- */
  function paint(ctx, scene, t) {
    var pal = scene.pal, cel = scene.celestial, tau = 6.2832;

    // 天空
    var sky = ctx.createLinearGradient(0, 0, 0, 1);
    sky.addColorStop(0, pal.sky[0]);
    sky.addColorStop(0.55, pal.sky[1]);
    sky.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1, 1);

    // 大气光斑（随时间缓慢漂移）
    for (var i = 0; i < scene.blobs.length; i++) {
      var b = scene.blobs[i];
      var bx = b.x + Math.sin(t * tau * b.sp + i) * 0.02 * b.dx;
      var by = b.y - t * 0.01 * b.sp;
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r + b.r * Math.sin(t * tau * 0.3 + i) * 0.06);
      g.addColorStop(0, rgba(b.c, b.a));
      g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1, 1);
    }

    // 星光闪烁
    ctx.fillStyle = '#ffffff';
    for (var s = 0; s < scene.stars.length; s++) {
      var st = scene.stars[s];
      ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(t * tau * st.tw + st.ph));
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, tau);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 天体
    paintCelestial(ctx, scene, t);

    // 光晕 / 辉光（天体周围）
    padGlow(ctx, cel.x, cel.y, cel.r * 3.1, cel.hue, 0.16 + 0.05 * Math.sin(t * tau * 0.6));

    // 地形（远层）
    paintRidge(ctx, scene.ridge.far, scene.ridge.farCol, 0.92);
    // 中景雾带
    var fog = ctx.createLinearGradient(0, scene.ridge.far[5].y - 0.02, 0, scene.ridge.far[5].y + 0.12);
    fog.addColorStop(0, rgba(pal.sky[2], 0));
    fog.addColorStop(0.55, rgba(pal.cloud, 0.14));
    fog.addColorStop(1, rgba(pal.cloud, 0));
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, 1, 1);

    // 地形（近层）
    paintRidge(ctx, scene.ridge.near, '#' + scene.ridge.nearCol.replace('#', ''), 1);

    // 漂浮粒子（随时间漂移、上浮）
    for (var p = 0; p < scene.parts.length; p++) {
      var pt = scene.parts[p];
      var px = pt.x + Math.sin(t * tau * pt.sp + pt.ph) * pt.amp;
      var py = pt.y - (t * pt.vy);
      if (py < -0.02) py = 1.02;
      ctx.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * tau + pt.ph));
      ctx.fillStyle = pt.c;
      ctx.beginPath();
      ctx.arc(px, py, pt.r, 0, tau);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 风格化调色（overlay）
    gradeOverlay(ctx, scene, t);
  }

  function padGlow(ctx, x, y, r, col, alpha) {
    var g = ctx.createRadialGradient(x, y, r * 0.25, x, y, r);
    g.addColorStop(0, rgba(col, alpha));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 1);
  }

  function paintCelestial(ctx, scene, t) {
    var cel = scene.celestial, pal = scene.pal, tau = 6.2832;
    var pulse = 0.94 + 0.06 * Math.sin(t * tau * 0.5);
    var r = cel.r * pulse;

    if (cel.type === 'moon') {
      var g = ctx.createRadialGradient(cel.x - r * 0.3, cel.y - r * 0.3, r * 0.1, cel.x, cel.y, r);
      g.addColorStop(0, '#fffdf0');
      g.addColorStop(0.72, '#eef0f7');
      g.addColorStop(1, '#c9cfe0');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cel.x, cel.y, r, 0, tau); ctx.fill();
      // 陨坑
      ctx.fillStyle = 'rgba(160,168,190,.4)';
      var craters = [[0.34, -0.28, 0.16], [-0.22, 0.3, 0.22], [0.55, 0.42, 0.13]];
      for (var i = 0; i < craters.length; i++) {
        ctx.beginPath();
        ctx.arc(cel.x + r * craters[i][0], cel.y + r * craters[i][1], r * craters[i][2], 0, tau);
        ctx.fill();
      }
    } else if (cel.type === 'orbit') {
      // 3D 星球 + 星环
      var bg = ctx.createRadialGradient(cel.x - r * 0.35, cel.y - r * 0.35, r * 0.1, cel.x, cel.y, r * 1.25);
      bg.addColorStop(0, '#fff8e8');
      bg.addColorStop(0.55, pal.glow);
      bg.addColorStop(1, pal.sky[1]);
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(cel.x, cel.y, r, 0, tau); ctx.fill();
      // 高光点
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.beginPath(); ctx.arc(cel.x - r * 0.34, cel.y - r * 0.34, r * 0.16, 0, tau); ctx.fill();
      // 轨道环
      ctx.save();
      ctx.translate(cel.x, cel.y);
      ctx.rotate(0.38 + t * 0.05);
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = rgba(pal.glow, 0.9);
      ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 2.15, r * 0.66, 0, 0, tau); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      // 太阳 / 光源
      var sg = ctx.createRadialGradient(cel.x, cel.y, 0, cel.x, cel.y, r);
      sg.addColorStop(0, '#fff8e8');
      sg.addColorStop(0.35, pal.glow);
      sg.addColorStop(0.8, rgba(pal.glow, 0.35));
      sg.addColorStop(1, rgba(pal.glow, 0));
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cel.x, cel.y, r * 1.25, 0, tau); ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.arc(cel.x, cel.y, r * 0.42, 0, tau); ctx.fill();

      // 光束（动漫 / 插画 / 部分风景）
      if (pal.rays) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = pal.glow;
        var nRays = 5;
        for (var i = 0; i < nRays; i++) {
          var ang = -0.55 + (i / (nRays - 1)) * 1.1;
          ctx.save();
          ctx.translate(cel.x, cel.y);
          ctx.rotate(ang);
          var grad = ctx.createLinearGradient(0, 0, 1.1, 0);
          grad.addColorStop(0, rgba(pal.glow, 0.9));
          grad.addColorStop(1, rgba(pal.glow, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(1.15, -0.16);
          ctx.lineTo(1.15, 0);
          ctx.lineTo(1.15, 0.16);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }

  function paintRidge(ctx, pts, col, alphaLevel) {
    var g = ctx.createLinearGradient(0, pts[0].y - 0.06, 0, 1);
    g.addColorStop(0, rgba(col, 0.25 * alphaLevel + 0.35));
    g.addColorStop(0.5, rgba(col, 0.85));
    g.addColorStop(1, rgba(col, 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    for (var i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(1, 1);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- 风格化调色叠加 ---------- */
  function gradeOverlay(ctx, scene, t) {
    var pal = scene.pal;
    ctx.globalCompositeOperation = 'overlay';
    if (scene.style === '电影感') {
      var warm = ctx.createLinearGradient(0, 0, 0, 1);
      warm.addColorStop(0, 'rgba(255,138,61,.10)');
      warm.addColorStop(0.5, 'rgba(255,138,61,0)');
      warm.addColorStop(0.75, 'rgba(20,90,110,.10)');
      warm.addColorStop(1, 'rgba(8,60,76,.22)');
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, 1, 1);
      // 变形宽银幕横条光
      var cx = scene.celestial.x, cy = scene.celestial.y;
      for (var k = 0; k < 2; k++) {
        var wy = cy - 0.04 + k * 0.085;
        var g = ctx.createLinearGradient(0, wy, 0, wy + 0.008);
        g.addColorStop(0, 'rgba(255,200,140,.0)');
        g.addColorStop(0.5, 'rgba(255,200,140,.16)');
        g.addColorStop(1, 'rgba(255,200,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, wy, 1, 0.012);
        ctx.globalAlpha = 1;
      }
    } else if (scene.style === '写实') {
      var ct = ctx.createLinearGradient(0, 0, 0, 1);
      ct.addColorStop(0, 'rgba(60,110,220,.06)');
      ct.addColorStop(0.6, 'rgba(255,180,120,0)');
      ct.addColorStop(1, 'rgba(255,140,90,.10)');
      ctx.fillStyle = ct;
      ctx.fillRect(0, 0, 1, 1);
    } else if (scene.style === '3D') {
      var bg = ctx.createRadialGradient(scene.celestial.x, scene.celestial.y, 0, scene.celestial.x, scene.celestial.y, 0.5);
      bg.addColorStop(0, rgba(pal.glow, 0.12));
      bg.addColorStop(1, 'rgba(0,0,0,.10)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1, 1);
    } else if (scene.style === '插画') {
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.fillRect(0, 0, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- 屏幕空间覆盖：暗角 + 颗粒 ---------- */
  var _grain = null;
  function grainPattern(ctx) {
    if (!_grain) {
      var c = document.createElement('canvas');
      c.width = 96; c.height = 96;
      var g = c.getContext('2d');
      var img = g.createImageData(96, 96);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      _grain = ctx.createPattern(c, 'repeat');
    }
    return _grain;
  }

  function finishPixels(ctx, W, H, style) {
    // 暗角
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.34)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // 颗粒
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = style === '插画' ? 0.05 : 0.075;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // 底部渐隐到背景，让画面融入页面
    var eb = ctx.createLinearGradient(0, H * 0.82, 0, H);
    eb.addColorStop(0, 'rgba(10,12,20,0)');
    eb.addColorStop(1, 'rgba(10,12,20,.28)');
    ctx.fillStyle = eb;
    ctx.fillRect(0, H * 0.82, W, H * 0.18);
  }

  /* ---------- 单帧 ---------- */
  function drawFrame(canvas, scene, t, camera) {
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // 镜头运动
    ctx.save();
    if (camera) {
      var cam = CAMERA[camera](t);
      ctx.translate(W / 2, H / 2);
      ctx.rotate(cam.r);
      ctx.scale(cam.z, cam.z);
      ctx.translate(cam.tx * W - W / 2, cam.ty * H - H / 2);
    }
    ctx.scale(W, H);
    paint(ctx, scene, t);
    ctx.restore();

    finishPixels(ctx, W, H, scene.style);
  }

  /* ---------- 对外：单张图片 ---------- */
  function generateImage(opts, onUpdate) {
    // opts: { prompt, ratio, style, seed }
    return new Promise(function (resolve, reject) {
      var size = IMAGE_RATIOS[opts.ratio] || [1024, 1024];
      var canvas = document.createElement('canvas');
      canvas.width = size[0]; canvas.height = size[1];
      var scene = buildScene(opts.seed, opts.style, opts.ratio);

      var steps = [
        [0.10, '正在解析画面描述…'],
        [0.38, '正在搭建画面构图…'],
        [0.72, '正在渲染色彩与光影…'],
        [0.96, '正在优化画面细节…']
      ];
      var stepI = 0;
      function tick(progress) {
        while (stepI < steps.length && steps[stepI][0] <= progress) {
          if (onUpdate) onUpdate({ progress: steps[stepI][0], phase: steps[stepI][1] });
          stepI++;
        }
      }
      tick(0);

      // 分阶段绘制，形成渐进感
      setTimeout(function () {
        try {
          drawFrame(canvas, scene, 0, null);
        } catch (e) { reject(new Error('渲染图片失败：' + e.message)); return; }
        tick(0.5);
        setTimeout(function () {
          tick(0.9);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('未能生成图片文件')); return; }
            if (onUpdate) onUpdate({ progress: 1, phase: '完成' });
            setTimeout(function () { resolve(blob); }, 120);
          }, 'image/png');
        }, 260);
      }, 90);
    });
  }

  /* ---------- 对外：视频 ---------- */
  function pickMime() {
    var list = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < list.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(list[i])) return list[i];
    }
    return '';
  }
  function canRecord() {
    return !!(window.MediaRecorder && document.createElement('canvas').captureStream);
  }

  function generateVideo(opts, onUpdate, signal) {
    // opts: { prompt, ratio, duration, camera, seed }
    // signal: { canceled: boolean }
    return new Promise(function (resolve, reject) {
      var size = VIDEO_RATIOS[opts.ratio] || [1280, 720];
      var canvas = document.createElement('canvas');
      canvas.width = size[0]; canvas.height = size[1];
      var scene = buildScene(opts.seed, opts.style || '电影感', opts.ratio);
      drawFrame(canvas, scene, 0, opts.camera); // 先画第一帧（作为封面与暖场）

      if (!canRecord()) {
        reject(new Error('当前浏览器不支持视频录制（请使用新版 Chrome / Edge）'));
        return;
      }
      var fps = 12;
      var stream;
      try { stream = canvas.captureStream(fps); }
      catch (e) { reject(new Error('无法启动视频引擎：' + e.message)); return; }

      var mime = pickMime();
      var rec;
      try {
        rec = new MediaRecorder(stream, { videoBitsPerSecond: 4_500_000, mimeType: mime || undefined });
      } catch (e) {
        reject(new Error('无法启动视频编码器：' + e.message));
        return;
      }

      var chunks = [];
      var closed = false;
      var start = performance.now();
      var durMs = opts.duration * 1000;
      var tickId = 0;
      var progressAt = 0;
      var frameInterval = 1000 / fps;

      function finish() {
        if (closed) return;
        closed = true;
        clearTimeout(tickId);
        rec.stop();
      }

      function tick() {
        if (signal.canceled) { finish(); return; }
        var elapsed = performance.now() - start;
        var t = Math.min(1, elapsed / durMs);
        try { drawFrame(canvas, scene, t, opts.camera); }
        catch (e) { closed = true; clearTimeout(tickId); reject(new Error('渲染视频帧失败：' + e.message)); return; }

        // 进度：绘制进度占 0–92%，最后 8% 留给编码与封装
        var p = t * 0.92;
        var phase = p < 0.08 ? '正在解析画面描述…'
                  : p < 0.35 ? '正在搭建画面构图…'
                  : p < 0.8  ? '正在渲染画面与光影…'
                  : p < 0.97 ? '正在合成视频帧…'
                  : '封装输出中…';
        progressAt = Math.max(progressAt, p);
        if (onUpdate) onUpdate({ progress: Math.min(progressAt + 0.001, 1), phase: phase });

        tickId = setTimeout(elapsed < durMs ? tick : function () { setTimeout(finish, 120); }, frameInterval);
      }

      function cleanup() { clearTimeout(tickId); }

      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) {
        cleanup();
        closed = true;
        reject(new Error('视频编码出错，请重试。'));
      };
      rec.onstop = function () {
        clearTimeout(tickId);
        var blob = new Blob(chunks, { type: mime || 'video/webm' });
        var thumb = canvas.toDataURL('image/jpeg', 0.72);
        if (onUpdate) onUpdate({ progress: 1, phase: '完成' });
        resolve({ blob: blob, thumb: thumb, duration: opts.duration });
      };

      try { rec.start(80); } catch (e) { reject(new Error('视频编码启动失败')); return; }
      tickId = setTimeout(tick, 0);
    });
  }

  /* ---------- 本地回退：图生图 / 图生视频（用上传的参考图做底） ---------- */
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('参考图片无法读取')); };
      img.src = src;
    });
  }

  function drawCover(ctx, img, W, H) {
    var iw = img.width, ih = img.height;
    var s = Math.max(W / iw, H / ih);
    var dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function styleTint(style) {
    switch (style) {
      case '动漫': return ['rgba(80,140,255,.16)', 'rgba(255,150,90,.12)'];
      case '电影感': return ['rgba(255,138,61,.10)', 'rgba(8,60,76,.20)'];
      case '插画': return ['rgba(255,200,180,.14)', 'rgba(255,255,255,.08)'];
      case '3D': return ['rgba(120,140,255,.14)', 'rgba(70,220,200,.08)'];
      default: return ['rgba(60,110,220,.07)', 'rgba(255,160,100,.08)'];
    }
  }

  function generateImageFromImages(opts, onUpdate) {
    // opts: { prompt, ratio, style, images:[dataURI], seed }
    return new Promise(function (resolve, reject) {
      var size = (opts.size && opts.size.length === 2) ? opts.size : (IMAGE_RATIOS[opts.ratio] || [1024, 1024]);
      var src = (opts.images && opts.images[0]) || '';
      loadImage(src).then(function (img) {
        var canvas = document.createElement('canvas');
        canvas.width = size[0]; canvas.height = size[1];
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#10131f';
        ctx.fillRect(0, 0, size[0], size[1]);
        drawCover(ctx, img, size[0], size[1]);
        // 风格化叠色 + 光晕 + 颗粒
        var tints = styleTint(opts.style);
        var rng = RNG.seeded(opts.seed || 'img2img');
        var glow = ctx.createRadialGradient(size[0] * (0.2 + rng() * 0.5), size[1] * (0.18 + rng() * 0.3), 0, size[0] * (0.2 + rng() * 0.5), size[1] * (0.18 + rng() * 0.3), size[0] * 0.7);
        glow.addColorStop(0, tints[0]);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, size[0], size[1]);
        var bg = ctx.createLinearGradient(0, 0, 0, size[1]);
        bg.addColorStop(0, 'rgba(0,0,0,0)');
        bg.addColorStop(1, tints[1]);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size[0], size[1]);
        finishPixels(ctx, size[0], size[1], '写实');
        if (onUpdate) onUpdate({ progress: 0.92, phase: '正在渲染风格化效果…' });
        canvas.toBlob(function (blob) {
          if (!blob) reject(new Error('图片生成失败'));
          else { if (onUpdate) onUpdate({ progress: 1, phase: '完成' }); setTimeout(function () { resolve(blob); }, 100); }
        }, 'image/png');
      }).catch(reject);
    });
  }

  function drawImageFrame(ctx, W, H, img, scene, t, camera, style) {
    ctx.save();
    if (camera) {
      var cam = CAMERA[camera](t);
      ctx.translate(W / 2, H / 2);
      ctx.rotate(cam.r);
      ctx.scale(cam.z, cam.z);
      ctx.translate(cam.tx * W - W / 2, cam.ty * H - H / 2);
    }
    drawCover(ctx, img, W, H);
    // 轻微呼吸光
    var tints = styleTint(style);
    var g = ctx.createRadialGradient(W * 0.4, H * 0.3, 0, W * 0.4, H * 0.3, W * 0.9);
    g.addColorStop(0, tints[0]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 漂浮粒子
    var tau = 6.2832;
    for (var i = 0; i < 14; i++) {
      var px = (i * 0.137 + 0.05) % 1 + Math.sin(t * tau * 0.4 + i) * 0.02;
      var py = (i * 0.071 + ((i * 7) % 11) * 0.09 - t * 0.015);
      if (py < -0.05) py += 1.1;
      if (py > 1.05) py -= 1.1;
      ctx.globalAlpha = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * tau + i * 1.3));
      ctx.fillStyle = tints[0].replace('#', '').length ? tints[0] : '#cfe0ff';
      ctx.beginPath();
      ctx.arc(px * W, py * H, 1.4 + (i % 3) * 0.8, 0, tau);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    finishPixels(ctx, W, H, style);
  }

  function generateVideoFromImages(opts, onUpdate, signal) {
    // opts: { prompt, ratio, duration, camera, style, images:[dataURI] }
    return new Promise(function (resolve, reject) {
      var size = (opts.size && opts.size.length === 2) ? opts.size : (VIDEO_RATIOS[opts.ratio] || [1280, 720]);
      var src = (opts.images && opts.images[0]) || '';
      loadImage(src).then(function (img) {
        var canvas = document.createElement('canvas');
        canvas.width = size[0]; canvas.height = size[1];
        var ctx = canvas.getContext('2d');

        if (!canRecord()) { reject(new Error('当前浏览器不支持本地视频预览')); return; }
        var fps = 10;
        var stream;
        try { stream = canvas.captureStream(fps); } catch (e) { reject(new Error('视频预览失败')); return; }
        var mime = pickMime();
        var rec;
        try { rec = new MediaRecorder(stream, { videoBitsPerSecond: 3_000_000, mimeType: mime || undefined }); }
        catch (e) { reject(new Error('视频编码器启动失败')); return; }

        var chunks = [], closed = false, tickId = 0;
        var start = performance.now(), durMs = opts.duration * 1000, progressAt = 0;
        var frameInterval = 1000 / fps;
        function finish() { if (closed) return; closed = true; clearTimeout(tickId); rec.stop(); }
        function tick() {
          if (signal && signal.canceled) { finish(); return; }
          var elapsed = performance.now() - start;
          var t = Math.min(1, elapsed / durMs);
          try { drawImageFrame(ctx, size[0], size[1], img, null, t, opts.camera, opts.style); }
          catch (e) { clearTimeout(tickId); reject(new Error('渲染失败')); return; }
          var p = t * 0.9;
          progressAt = Math.max(progressAt, p);
          if (onUpdate) onUpdate({ progress: Math.min(progressAt + 0.001, 1), phase: p < 0.5 ? '正在渲染画面与光影…' : '正在合成视频帧…' });
          tickId = setTimeout(elapsed < durMs ? tick : function () { setTimeout(finish, 120); }, frameInterval);
        }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = function () { clearTimeout(tickId); closed = true; reject(new Error('视频编码出错')); };
        rec.onstop = function () {
          clearTimeout(tickId);
          var blob = new Blob(chunks, { type: mime || 'video/webm' });
          var thumb = canvas.toDataURL('image/jpeg', 0.72);
          if (onUpdate) onUpdate({ progress: 1, phase: '完成' });
          resolve({ blob: blob, thumb: thumb, duration: opts.duration });
        };
        try { rec.start(80); } catch (e) { reject(new Error('视频编码启动失败')); return; }
        tickId = setTimeout(tick, 0);
      }).catch(reject);
    });
  }

  /* ---------- 导出 ---------- */
  global.Art = {
    IMAGE_RATIOS: IMAGE_RATIOS,
    VIDEO_RATIOS: VIDEO_RATIOS,
    CAMERA_KEYS: Object.keys(CAMERA),
    generateImage: generateImage,
    generateVideo: generateVideo,
    generateImageFromImages: generateImageFromImages,
    generateVideoFromImages: generateVideoFromImages,
    canRecord: canRecord,
    pickMime: pickMime
  };
})(window || globalThis);