/**
 * SDK injected into the <head> of every AI-generated HTML5 game.
 * Provides PB.* API for game code to interact with the parent frame.
 * Game code never touches postMessage directly.
 */
export const IFRAME_SDK_CODE = `
<script>
(function() {
  "use strict";

  // --- State ---
  var _score = 0;
  var _started = false;
  var _ended = false;
  var _player = { id: "", name: "Player", emoji: "🎮", color: "#3498db", index: 0 };
  var _config = { timeLimit: 30, difficulty: 1, theme: "" };
  var _sprites = {};
  var _theme = { emoji: "🎮", primaryColor: "#6c5ce7", secondaryColor: "#00cec9", accentColor: "#fdcb6e" };
  var _onStartCb = null;
  var _onEndCb = null;
  var _canvas = null;
  var _ctx = null;
  var _animFrame = null;
  var _imageCache = {};

  // --- Input state ---
  var _input = {
    left: false, right: false, up: false, down: false, action: false,
    pointerX: 0, pointerY: 0, pointerDown: false,
    _tapCbs: [], _swipeCbs: [],
    onTap: function(cb) { _input._tapCbs.push(cb); },
    onSwipe: function(cb) { _input._swipeCbs.push(cb); }
  };

  // --- Audio (Web Audio API synth) ---
  var _audioCtx = null;
  var _audioUnlocked = false;
  function _getAudio() {
    if (!_audioCtx) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    // Resume suspended context (browser requires user gesture)
    if (_audioCtx && _audioCtx.state === "suspended") {
      _audioCtx.resume().catch(function(){});
    }
    return _audioCtx;
  }
  // Unlock audio on first user interaction (required by browsers)
  function _unlockAudio() {
    if (_audioUnlocked) return;
    var ctx = _getAudio();
    if (ctx) { _audioUnlocked = true; }
  }
  document.addEventListener("mousedown", _unlockAudio, { once: false });
  document.addEventListener("touchstart", _unlockAudio, { once: false });
  document.addEventListener("keydown", _unlockAudio, { once: false });

  // Pitch variation to prevent repetition anti-pattern (game-audio best practice)
  function _vary(freq, pct) { return freq * (1 + (Math.random() - 0.5) * (pct || 0.08)); }

  function _playTone(freq, duration, type, vol) {
    var ctx = _getAudio(); if (!ctx || ctx.state === "suspended") return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = _vary(freq, 0.06);
    gain.gain.value = vol || 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration || 0.1));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + (duration || 0.1));
  }

  var _audio = {
    beep:    function() { _playTone(440, 0.08, "square", 0.12); },
    success: function() { _playTone(523, 0.1, "sine", 0.15); setTimeout(function(){ _playTone(659, 0.1, "sine", 0.15); }, 100); setTimeout(function(){ _playTone(784, 0.15, "sine", 0.15); }, 200); },
    fail:    function() { _playTone(200, 0.2, "sawtooth", 0.12); setTimeout(function(){ _playTone(150, 0.3, "sawtooth", 0.12); }, 150); },
    collect: function() {
      // Pitch-shifts based on combo count (Katamari effect)
      var comboBoost = Math.min(_comboCount, 20) * 30;
      _playTone(880 + comboBoost, 0.06, "square", 0.1);
      setTimeout(function(){ _playTone(1100 + comboBoost, 0.08, "square", 0.1); }, 60);
    },
    tick:    function() { _playTone(1000, 0.03, "sine", 0.08); },
    // New expanded audio
    combo:   function() {
      // Rising arpeggio
      _playTone(523, 0.06, "sine", 0.1);
      setTimeout(function(){ _playTone(659, 0.06, "sine", 0.1); }, 50);
      setTimeout(function(){ _playTone(784, 0.06, "sine", 0.1); }, 100);
      setTimeout(function(){ _playTone(1047, 0.1, "sine", 0.12); }, 150);
    },
    milestone: function() {
      // Major chord
      _playTone(523, 0.15, "sine", 0.12);
      _playTone(659, 0.15, "sine", 0.1);
      _playTone(784, 0.15, "sine", 0.1);
      setTimeout(function(){ _playTone(1047, 0.2, "sine", 0.15); }, 100);
    },
    countdown: function() { _playTone(220, 0.15, "triangle", 0.1); },
    timeWarning: function() {
      _playTone(800, 0.05, "square", 0.08);
      setTimeout(function(){ _playTone(800, 0.05, "square", 0.08); }, 80);
      setTimeout(function(){ _playTone(800, 0.05, "square", 0.08); }, 160);
    },
    whoosh: function() {
      var ctx = _getAudio(); if (!ctx || ctx.state === "suspended") return;
      var bufferSize = ctx.sampleRate * 0.15;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/bufferSize);
      var src = ctx.createBufferSource();
      var gain = ctx.createGain();
      src.buffer = buffer;
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      src.connect(gain); gain.connect(ctx.destination);
      src.start(); src.stop(ctx.currentTime + 0.15);
    }
  };

  // --- Combo/Streak Tracking ---
  var _comboCount = 0;
  var _comboMultiplier = 1;
  var _comboMax = 0;
  var _comboTimer = 0;
  var _comboDecayTime = 1.5; // seconds before combo decays

  var _comboMilestones = [
    { count: 5, text: "NICE!", color: "#4ade80" },
    { count: 10, text: "AMAZING!", color: "#fbbf24" },
    { count: 15, text: "LEGENDARY!", color: "#f472b6" },
    { count: 25, text: "GODLIKE!", color: "#c084fc" }
  ];

  function _comboHit() {
    _comboCount++;
    _comboTimer = _comboDecayTime;
    _comboMultiplier = Math.min(5, 1 + Math.floor(_comboCount / 5));
    if (_comboCount > _comboMax) _comboMax = _comboCount;

    // Check milestones
    for (var i = 0; i < _comboMilestones.length; i++) {
      if (_comboCount === _comboMilestones[i].count) {
        var ms = _comboMilestones[i];
        var cx = (_canvas ? _canvas.width / (window.devicePixelRatio || 1) / 2 : 200);
        var cy = (_canvas ? _canvas.height / (window.devicePixelRatio || 1) / 2 : 150);
        _floatText(ms.text, cx, cy - 40, { color: ms.color, size: 36, vy: -3, life: 60 });
        _spawnParticles(cx, cy, { count: 12, color: ms.color, speed: 5, life: 40 });
        _audio.combo();
        _flash(ms.color, 12);
        // Haptic
        _hapticPattern([50, 30, 50, 30, 100]);
        break;
      }
    }

    return _comboMultiplier;
  }

  function _comboMiss() {
    _comboCount = 0;
    _comboMultiplier = 1;
    _comboTimer = 0;
  }

  function _updateCombo(dt) {
    if (_comboCount > 0 && _comboTimer > 0) {
      _comboTimer -= dt;
      if (_comboTimer <= 0) {
        _comboMiss();
      }
    }
  }

  var _combo = {
    hit: _comboHit,
    miss: _comboMiss,
    get current() { return _comboCount; },
    get multiplier() { return _comboMultiplier; },
    get max() { return _comboMax; }
  };

  // --- Haptic Feedback ---
  function _hapticBuzz(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 50); } catch(e) {}
  }
  function _hapticPattern(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {}
  }

  // --- Background Music System ---
  var _musicPlaying = false;
  var _musicGainNode = null;
  var _musicOscs = [];
  var _musicInterval = null;
  var _musicIntensity = 0.3;
  var _musicBaseGain = 0.08;

  var _musicPatterns = {
    chill:       { notes: [261, 329, 392, 329, 261, 392, 329, 261], bpm: 100, type: "sine" },
    competitive: { notes: [220, 261, 329, 392, 349, 329, 261, 220], bpm: 130, type: "triangle" },
    chaotic:     { notes: [233, 311, 369, 415, 311, 369, 233, 415], bpm: 160, type: "sawtooth" },
    silly:       { notes: [261, 277, 293, 311, 329, 311, 293, 277], bpm: 120, type: "square" },
    creative:    { notes: [329, 392, 493, 392, 329, 493, 392, 329], bpm: 110, type: "sine" },
    spicy:       { notes: [220, 277, 329, 369, 329, 277, 220, 369], bpm: 140, type: "triangle" },
    wholesome:   { notes: [261, 329, 392, 523, 392, 329, 261, 392], bpm: 95, type: "sine" }
  };

  function _musicStart() {
    var ctx = _getAudio(); if (!ctx) return;
    if (_musicPlaying) return;
    _musicPlaying = true;

    // Pick pattern based on theme mood
    var mood = (_config.theme || "competitive").toLowerCase();
    var pattern = _musicPatterns[mood] || _musicPatterns.competitive;
    var noteIdx = 0;
    var msPerBeat = 60000 / pattern.bpm;

    _musicGainNode = ctx.createGain();
    _musicGainNode.gain.value = _musicBaseGain;
    _musicGainNode.connect(ctx.destination);

    _musicInterval = setInterval(function() {
      if (_paused || _ended || !_musicPlaying) return;
      var ctx2 = _getAudio(); if (!ctx2) return;

      var freq = pattern.notes[noteIdx % pattern.notes.length];
      // Intensity affects octave jump and volume
      if (_musicIntensity > 0.7) freq *= 2;
      var dur = msPerBeat / 1000 * 0.8;

      var osc = ctx2.createOscillator();
      var noteGain = ctx2.createGain();
      osc.type = pattern.type;
      osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.02);
      var vol = _musicBaseGain * (0.5 + _musicIntensity * 0.5);
      noteGain.gain.value = vol;
      noteGain.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + dur);
      osc.connect(noteGain);
      noteGain.connect(ctx2.destination);
      osc.start();
      osc.stop(ctx2.currentTime + dur);

      noteIdx++;
    }, msPerBeat);
  }

  function _musicStop() {
    _musicPlaying = false;
    if (_musicInterval) { clearInterval(_musicInterval); _musicInterval = null; }
  }

  function _musicSetIntensity(val) {
    _musicIntensity = Math.max(0, Math.min(1, val));
  }

  var _music = {
    setIntensity: _musicSetIntensity,
    stop: _musicStop,
    start: _musicStart,
    get playing() { return _musicPlaying; },
    get intensity() { return _musicIntensity; }
  };

  // --- Score Milestones ---
  var _lastMilestone = 0;
  var _scoreMilestones = [50, 100, 200, 300, 500];

  function _checkScoreMilestone(newScore) {
    for (var i = _scoreMilestones.length - 1; i >= 0; i--) {
      var ms = _scoreMilestones[i];
      if (newScore >= ms && _lastMilestone < ms) {
        _lastMilestone = ms;
        var cx = (_canvas ? _canvas.width / (window.devicePixelRatio || 1) / 2 : 200);
        var cy = (_canvas ? _canvas.height / (window.devicePixelRatio || 1) / 3 : 100);
        _floatText(ms + " PTS!", cx, cy, { color: "#c084fc", size: 32, vy: -2.5, life: 50 });
        _spawnParticles(cx, cy, { count: 10, color: "#c084fc", speed: 4, life: 35 });
        _flash("#c084fc", 10);
        _audio.milestone();
        _hapticPattern([80, 40, 80, 40, 120]);
        break;
      }
    }
  }

  // --- Visibility: pause when tab is hidden (web-games best practice) ---
  var _paused = false;
  var _onPauseCb = null;
  var _onResumeCb = null;
  document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
      _paused = true;
      if (_onPauseCb) try { _onPauseCb(); } catch(e) {}
    } else {
      _paused = false;
      if (_onResumeCb) try { _onResumeCb(); } catch(e) {}
    }
  });

  // --- Delta time helper (accurate timing across frame rates) ---
  var _lastFrameTime = 0;
  var _dt = 1/60;
  function _getDelta() {
    var now = performance.now();
    if (_lastFrameTime > 0) {
      _dt = Math.min((now - _lastFrameTime) / 1000, 0.05); // cap at 50ms to avoid spiral
    }
    _lastFrameTime = now;
    return _dt;
  }

  // --- Helpers ---
  function _random(min, max) { return Math.random() * (max - min) + min; }
  function _randomInt(min, max) { return Math.floor(_random(min, max + 1)); }
  function _lerp(a, b, t) { return a + (b - a) * t; }
  function _distance(x1, y1, x2, y2) { var dx=x2-x1, dy=y2-y1; return Math.sqrt(dx*dx+dy*dy); }
  function _clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  function _loadImage(url) {
    if (_imageCache[url]) return Promise.resolve(_imageCache[url]);
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function() { _imageCache[url] = img; resolve(img); };
      img.onerror = function() { reject(new Error("Failed to load: " + url)); };
      img.src = url;
    });
  }

  // --- Canvas helper ---
  function _createCanvas(w, h) {
    if (_canvas) return { canvas: _canvas, ctx: _ctx };
    var dpr = window.devicePixelRatio || 1;
    _canvas = document.createElement("canvas");
    var width = w || window.innerWidth;
    var height = h || window.innerHeight;
    _canvas.width = width * dpr;
    _canvas.height = height * dpr;
    _canvas.style.width = width + "px";
    _canvas.style.height = height + "px";
    _canvas.style.display = "block";
    _canvas.style.touchAction = "none";
    document.body.appendChild(_canvas);
    _ctx = _canvas.getContext("2d");
    _ctx.scale(dpr, dpr);
    _wrapCtxDrawMethods(_ctx);

    // Handle resize
    window.addEventListener("resize", function() {
      var nw = w || window.innerWidth;
      var nh = h || window.innerHeight;
      var ndpr = window.devicePixelRatio || 1;
      _canvas.width = nw * ndpr;
      _canvas.height = nh * ndpr;
      _canvas.style.width = nw + "px";
      _canvas.style.height = nh + "px";
      _ctx.scale(ndpr, ndpr);
    });

    return { canvas: _canvas, ctx: _ctx, width: width, height: height };
  }

  // --- Input handling ---
  var _touchStart = null;
  var _canvasRect = null; // Cached canvas bounding rect, updated each frame in _updateJuice
  document.addEventListener("keydown", function(e) {
    if (e.key === "ArrowLeft" || e.key === "a") _input.left = true;
    if (e.key === "ArrowRight" || e.key === "d") _input.right = true;
    if (e.key === "ArrowUp" || e.key === "w") _input.up = true;
    if (e.key === "ArrowDown" || e.key === "s") _input.down = true;
    if (e.key === " " || e.key === "Enter") _input.action = true;
  });
  document.addEventListener("keyup", function(e) {
    if (e.key === "ArrowLeft" || e.key === "a") _input.left = false;
    if (e.key === "ArrowRight" || e.key === "d") _input.right = false;
    if (e.key === "ArrowUp" || e.key === "w") _input.up = false;
    if (e.key === "ArrowDown" || e.key === "s") _input.down = false;
    if (e.key === " " || e.key === "Enter") _input.action = false;
  });

  function _toCanvasX(clientX) {
    return _canvasRect ? clientX - _canvasRect.left : clientX;
  }
  function _toCanvasY(clientY) {
    return _canvasRect ? clientY - _canvasRect.top : clientY;
  }

  function _getPointerPos(e) {
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    _input.pointerX = _toCanvasX(t.clientX);
    _input.pointerY = _toCanvasY(t.clientY);
  }

  document.addEventListener("mousedown", function(e) { _input.pointerDown = true; _getPointerPos(e); _input._tapCbs.forEach(function(cb){cb(_toCanvasX(e.clientX),_toCanvasY(e.clientY));}); });
  document.addEventListener("mouseup", function(e) { _input.pointerDown = false; });
  document.addEventListener("mousemove", function(e) { _getPointerPos(e); });

  document.addEventListener("touchstart", function(e) {
    _input.pointerDown = true;
    _getPointerPos(e);
    _touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    _input._tapCbs.forEach(function(cb){ cb(_toCanvasX(e.touches[0].clientX), _toCanvasY(e.touches[0].clientY)); });
  }, { passive: true });
  document.addEventListener("touchend", function(e) {
    _input.pointerDown = false;
    if (_touchStart) {
      var dt = Date.now() - _touchStart.t;
      var te = e.changedTouches[0];
      if (te && dt < 500) {
        var dx = te.clientX - _touchStart.x;
        var dy = te.clientY - _touchStart.y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 30) {
          var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
          _input._swipeCbs.forEach(function(cb){ cb(dir, dist); });
        }
      }
      _touchStart = null;
    }
  }, { passive: true });
  document.addEventListener("touchmove", function(e) { _getPointerPos(e); }, { passive: true });

  // --- Drawing helpers ---
  function _drawText(ctx, text, x, y, opts) {
    opts = opts || {};
    var size = opts.size || 16;
    var color = opts.color || "#fff";
    var align = opts.align || "center";
    var font = opts.font || ("bold " + size + "px system-ui, sans-serif");
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = opts.baseline || "middle";
    if (opts.outline) {
      ctx.strokeStyle = opts.outline;
      ctx.lineWidth = opts.outlineWidth || 3;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function _drawEmoji(ctx, emoji, x, y, size) {
    size = size || 32;
    ctx.save();
    ctx.font = size + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, x, y);
    ctx.restore();
  }

  function _drawRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r || 8, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // --- PostMessage comm ---
  function _send(msg) { window.parent.postMessage(msg, "*"); }

  // --- Health Monitoring State ---
  var _frameCount = 0;
  var _drawCallCount = 0;  // Total draw calls since last heartbeat
  var _rafErrorCount = 0;
  var _RAF_ERROR_LIMIT = 5;

  // --- RAF Error Boundary ---
  // Wrap requestAnimationFrame to catch game loop errors
  var _origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function(cb) {
    return _origRAF(function(ts) {
      _frameCount++;
      try {
        cb(ts);
      } catch(err) {
        _rafErrorCount++;
        var msg = (err && err.message) ? err.message : String(err);
        console.error("[PB] RAF error #" + _rafErrorCount + ": " + msg);
        if (_rafErrorCount >= _RAF_ERROR_LIMIT) {
          _send({ type: "GAME_ERROR", payload: { message: "Fatal: " + msg, fatal: true } });
        } else {
          _send({ type: "GAME_ERROR", payload: { message: "RAF error: " + msg, fatal: false } });
          // Re-schedule to keep the loop alive for transient errors
          _origRAF(cb);
        }
      }
    });
  };

  // --- Canvas Draw Detection ---
  // Wrap canvas context draw methods to count draw calls per heartbeat period.
  // A real game has many draw calls per frame (background + player + items + UI).
  // A "blank" game only does 1-2 per frame (just background fill).
  var _drawMethods = ["fillRect", "strokeRect", "drawImage", "fillText", "strokeText", "fill", "stroke", "putImageData"];
  function _wrapCtxDrawMethods(ctx) {
    _drawMethods.forEach(function(method) {
      if (ctx[method]) {
        var orig = ctx[method].bind(ctx);
        ctx[method] = function() { _drawCallCount++; return orig.apply(ctx, arguments); };
      }
    });
  }

  // Heartbeat every 2s so parent knows we're alive — now includes health payload
  var _lastHbFrameCount = 0;
  setInterval(function() {
    if (_started && !_ended) {
      var framesSinceLastHb = _frameCount - _lastHbFrameCount;
      // draws-per-frame: a real game has 5+ draw calls per frame; blank = 1-2 (just bg fill)
      var dpf = framesSinceLastHb > 0 ? (_drawCallCount / framesSinceLastHb) : 0;
      _send({ type: "HEARTBEAT", payload: { fc: _frameCount, dpf: Math.round(dpf * 10) / 10, score: _score, err: _rafErrorCount } });
      _drawCallCount = 0; // Reset after each heartbeat
      _lastHbFrameCount = _frameCount;
    }
  }, 2000);

  window.addEventListener("message", function(e) {
    var d = e.data;
    if (!d || !d.type) return;

    if (d.type === "GAME_INIT") {
      var p = d.payload;
      if (p.player) _player = p.player;
      if (p.config) _config = p.config;
      if (p.sprites) _sprites = p.sprites;
      if (p.theme) _theme = p.theme;
    }
    else if (d.type === "GAME_START") {
      _started = true;
      // Auto-start background music
      _musicStart();
      if (_onStartCb) try { _onStartCb(); } catch(err) { _send({ type: "GAME_ERROR", payload: { message: "onStart error: " + err.message } }); }
    }
    else if (d.type === "GAME_END") {
      _ended = true;
      _musicStop();
      if (_onEndCb) try { _onEndCb(); } catch(err) {}
      _send({ type: "GAME_COMPLETE", payload: { score: _score } });
    }
  });

  // --- Juice: Screen Shake ---
  var _shakeX = 0, _shakeY = 0, _shakeMag = 0, _shakeDecay = 0.9;
  function _shake(magnitude, decay) {
    _shakeMag = magnitude || 8;
    _shakeDecay = decay || 0.85;
    // Auto-haptic on shake
    _hapticBuzz(Math.min(100, Math.round(_shakeMag * 6)));
  }
  function _updateShake() {
    if (_shakeMag > 0.5) {
      _shakeX = (Math.random() - 0.5) * _shakeMag * 2;
      _shakeY = (Math.random() - 0.5) * _shakeMag * 2;
      _shakeMag *= _shakeDecay;
    } else { _shakeX = 0; _shakeY = 0; _shakeMag = 0; }
  }

  // --- Juice: Particles ---
  var _particles = [];
  function _spawnParticles(x, y, opts) {
    opts = opts || {};
    var count = Math.min(opts.count || 8, 12); // Cap at 12 per burst
    var color = opts.color || "#ffd700";
    var speed = opts.speed || 3;
    var life = opts.life || 30;
    var size = opts.size || 4;
    // Cap total particles at 80
    var room = 80 - _particles.length;
    if (room <= 0) return;
    count = Math.min(count, room);
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + _random(-0.3, 0.3);
      _particles.push({ x: x, y: y, vx: Math.cos(angle) * speed * _random(0.5, 1.5), vy: Math.sin(angle) * speed * _random(0.5, 1.5), life: life, maxLife: life, color: color, size: size });
    }
  }
  function _updateParticles() {
    for (var i = _particles.length - 1; i >= 0; i--) {
      var p = _particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
      if (p.life <= 0) _particles.splice(i, 1);
    }
  }
  function _drawParticles(ctx) {
    for (var i = 0; i < _particles.length; i++) {
      var p = _particles[i];
      var alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --- Juice: Floating Text ---
  var _floaters = [];
  function _floatText(text, x, y, opts) {
    opts = opts || {};
    _floaters.push({ text: text, x: x, y: y, vy: opts.vy || -2, life: opts.life || 40, maxLife: opts.life || 40, color: opts.color || "#fff", size: opts.size || 20 });
  }
  function _updateFloaters() {
    for (var i = _floaters.length - 1; i >= 0; i--) {
      var f = _floaters[i];
      f.y += f.vy; f.life--;
      if (f.life <= 0) _floaters.splice(i, 1);
    }
  }
  function _drawFloaters(ctx) {
    for (var i = 0; i < _floaters.length; i++) {
      var f = _floaters[i];
      var alpha = f.life / f.maxLife;
      ctx.globalAlpha = alpha;
      _drawText(ctx, f.text, f.x, f.y, { size: f.size, color: f.color, outline: "#000", outlineWidth: 2 });
    }
    ctx.globalAlpha = 1;
  }

  // --- Juice: Flash overlay ---
  var _flashAlpha = 0, _flashColor = "#fff";
  function _flash(color, duration) {
    _flashColor = color || "#fff";
    _flashAlpha = 1;
    var decay = 1 / ((duration || 10));
    var _flashInterval = setInterval(function() {
      _flashAlpha -= decay;
      if (_flashAlpha <= 0) { _flashAlpha = 0; clearInterval(_flashInterval); }
    }, 16);
  }
  function _drawFlash(ctx, W, H) {
    if (_flashAlpha > 0) {
      ctx.globalAlpha = _flashAlpha * 0.4;
      ctx.fillStyle = _flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // --- Juice: Easing ---
  function _easeOutBounce(t) {
    if (t < 1/2.75) return 7.5625*t*t;
    if (t < 2/2.75) { t -= 1.5/2.75; return 7.5625*t*t + 0.75; }
    if (t < 2.5/2.75) { t -= 2.25/2.75; return 7.5625*t*t + 0.9375; }
    t -= 2.625/2.75; return 7.5625*t*t + 0.984375;
  }
  function _easeOutElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10*t) * Math.sin((t - 0.075) * (2*Math.PI) / 0.3) + 1;
  }
  function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function _easeInOutQuad(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; }

  // --- Juice: Timer display ---
  function _drawTimer(ctx, timeLeft, totalTime, W) {
    var pct = timeLeft / totalTime;
    var barW = W - 20;
    var barH = 6;
    var x = 10, y = 10;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    _drawRoundRect(ctx, x, y, barW, barH, 3); ctx.fill();
    var col = pct > 0.3 ? "#4ade80" : pct > 0.15 ? "#fbbf24" : "#ef4444";
    ctx.fillStyle = col;
    _drawRoundRect(ctx, x, y, barW * Math.max(0, pct), barH, 3); ctx.fill();
    if (pct <= 0.2) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(Date.now() / 200));
      _drawText(ctx, Math.ceil(timeLeft) + "", W / 2, 30, { size: 18, color: "#ef4444", outline: "#000" });
      ctx.globalAlpha = 1;
    }
  }

  // --- Juice master update (call in game loop) ---
  function _updateJuice() {
    // Cache canvas rect once per frame for coordinate mapping (avoids layout thrash)
    if (_canvas) _canvasRect = _canvas.getBoundingClientRect();
    _updateShake();
    _updateParticles();
    _updateFloaters();
    _updateCombo(_dt);
  }
  function _drawJuice(ctx, W, H) { _drawParticles(ctx); _drawFloaters(ctx); _drawFlash(ctx, W, H); }

  // --- Collision helpers ---
  function _rectCollide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function _circleCollide(x1, y1, r1, x2, y2, r2) {
    var dx = x2 - x1, dy = y2 - y1;
    return dx*dx + dy*dy < (r1+r2)*(r1+r2);
  }

  // --- Public API ---
  window.PB = {
    ready: function() { _send({ type: "GAME_READY" }); },
    onStart: function(cb) { _onStartCb = cb; if (_started) cb(); },
    onEnd: function(cb) { _onEndCb = cb; },
    setScore: function(n) {
      _score = Math.max(0, Math.floor(n));
      _checkScoreMilestone(_score);
      _send({ type: "SCORE_UPDATE", payload: { score: _score } });
    },
    addScore: function(n) {
      _score = Math.max(0, _score + Math.floor(n));
      _checkScoreMilestone(_score);
      _send({ type: "SCORE_UPDATE", payload: { score: _score } });
    },
    endGame: function(finalScore) {
      if (_ended) return;
      _ended = true;
      _musicStop();
      if (finalScore !== undefined) _score = Math.max(0, Math.floor(finalScore));
      _send({ type: "GAME_COMPLETE", payload: { score: _score } });
    },

    get player() { return _player; },
    get config() { return _config; },
    get sprites() { return _sprites; },
    get input() { return _input; },
    get audio() { return _audio; },
    get theme() { return _theme; },
    get combo() { return _combo; },
    get music() { return _music; },

    createCanvas: _createCanvas,
    loadImage: _loadImage,

    // Drawing helpers
    text: _drawText,
    emoji: _drawEmoji,
    roundRect: _drawRoundRect,

    // Juice system — call updateJuice() in your game loop, drawJuice(ctx,W,H) after scene render
    shake: _shake,             // (magnitude?, decay?) — screen shake, apply PB.shakeX/Y to camera
    get shakeX() { return _shakeX; },
    get shakeY() { return _shakeY; },
    particles: _spawnParticles, // (x, y, {count, color, speed, life, size}) — burst particles
    float: _floatText,         // (text, x, y, {color, size, vy, life}) — floating score text
    flash: _flash,             // (color?, duration?) — screen flash
    drawTimer: _drawTimer,     // (ctx, timeLeft, totalTime, canvasWidth) — timer bar
    updateJuice: _updateJuice, // call once per frame to update all juice systems
    drawJuice: _drawJuice,     // (ctx, W, H) — draw particles, floaters, flash

    // Collision helpers
    rectCollide: _rectCollide,   // ({x,y,w,h}, {x,y,w,h}) — AABB collision
    circleCollide: _circleCollide, // (x1,y1,r1, x2,y2,r2) — circle collision

    // Easing functions (t: 0-1)
    easeOutBounce: _easeOutBounce,
    easeOutElastic: _easeOutElastic,
    easeOutCubic: _easeOutCubic,
    easeInOutQuad: _easeInOutQuad,

    // Pause/visibility
    get paused() { return _paused; },
    onPause: function(cb) { _onPauseCb = cb; },
    onResume: function(cb) { _onResumeCb = cb; },

    // Delta time — call once per frame, returns seconds since last frame
    delta: _getDelta,       // () → dt in seconds (capped at 0.05)

    random: _random,
    randomInt: _randomInt,
    lerp: _lerp,
    distance: _distance,
    clamp: _clamp
  };

  // Global error handler
  window.addEventListener("error", function(e) {
    _send({ type: "GAME_ERROR", payload: { message: e.message || "Unknown error" } });
  });
})();
</script>`;
