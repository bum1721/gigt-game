(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const startBtn= document.getElementById('startBtn');
  const toast   = document.getElementById('toast');
  const soundBtn= document.getElementById('soundBtn');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 900);
  }

  // ===== Sound (no file) =====
  let audioCtx = null;
  let soundOn = true;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(freq, dur=0.08, type='sine', gain=0.05) {
    if (!soundOn) return;
    ensureAudio();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function boom() {
    if (!soundOn) return;
    ensureAudio();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.22);
  }

  function updateSoundUI() { soundBtn.textContent = soundOn ? '🔊' : '🔇'; }
  updateSoundUI();

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    updateSoundUI();
    if (soundOn) beep(660, 0.06, 'sine', 0.05);
  });

  // ===== Resize =====
  function resize() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  // ===== Assets =====
  const imgChar = new Image(); imgChar.src = 'assets/character.png';
  const imgGift = new Image(); imgGift.src = 'assets/gift.png';
  const imgBomb = new Image(); imgBomb.src = 'assets/bomb.png';

  let assetErrorShown = false;
  function markAssetError() {
    if (assetErrorShown) return;
    assetErrorShown = true;
    overlay.classList.add('show');
    overlay.querySelector('h1').textContent = '파일 경로 문제';
    overlay.querySelector('p').innerHTML =
      '캐릭터/이미지 파일을 못 불러왔습니다.<br/><b>assets 폴더</b>가 저장소(깃허브)에 올라갔는지 확인해주세요.';
    startBtn.textContent = '확인 후 다시';
  }
  imgChar.onerror = markAssetError;
  imgGift.onerror = markAssetError;
  imgBomb.onerror = markAssetError;

  // ===== Game State =====
  const state = {
    running: false,
    t: 0,
    score: 0,
    lives: 3,
    speed: 1.0,
    spawnTimer: 0,
    entities: [],
    player: { x: 0, y: 0, w: 120, h: 160, targetX: 0 }
  };

  function resetGame() {
    state.t = 0;
    state.score = 0;
    state.lives = 3;
    state.speed = 1.0;
    state.spawnTimer = 0;
    state.entities.length = 0;

    const W = canvas.width, H = canvas.height;
    const p = state.player;
    const base = Math.min(W, H);
    p.h = Math.floor(base * 0.26);
    p.w = Math.floor(p.h * 0.68);
    p.x = Math.floor(W * 0.5);
    p.targetX = p.x;
    p.y = Math.floor(H - p.h * 0.62);

    scoreEl.textContent = '0';
    livesEl.textContent = '3';
  }

  function startGame() {
    ensureAudio();
    resetGame();
    overlay.classList.remove('show');
    state.running = true;
    showToast('시작! 🎮');
    beep(660, 0.06, 'sine', 0.06);
    beep(880, 0.06, 'sine', 0.06);
  }

  function endGame() {
    state.running = false;
    overlay.classList.add('show');
    overlay.querySelector('.title').textContent = '🎮 용용이게임';
    overlay.querySelector('h1').textContent = '게임 오버';
    overlay.querySelector('p').innerHTML = `점수: <b>${state.score}</b><br/>다시 시작할까요?`;
    startBtn.textContent = '다시 시작';
    boom();
  }

  // ===== Spawning =====
  function spawn() {
    const W = canvas.width;
    const base = Math.min(canvas.width, canvas.height);
    const size = Math.floor(base * 0.10);
    const x = Math.floor(Math.random() * (W - size) + size/2);
    const y = -size;

    const bombChance = Math.min(0.22 + state.t * 0.02, 0.55);
    const isBomb = Math.random() < bombChance;

    const vy = (2.4 + Math.random() * 1.4) * state.speed * (W/900);
    state.entities.push({ x, y, size, vy, type: isBomb ? 'bomb' : 'gift' });
  }

  // ===== Controls =====
  let pointerDown = false;

  function clientToCanvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    return (clientX - rect.left) * dpr;
  }

  function onPointerDown(e) {
    pointerDown = true;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    state.player.targetX = clientToCanvasX(cx);
    ensureAudio();
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    state.player.targetX = clientToCanvasX(cx);
  }
  function onPointerUp() { pointerDown = false; }

  canvas.addEventListener('touchstart', onPointerDown, {passive:false});
  canvas.addEventListener('touchmove',  onPointerMove, {passive:false});
  canvas.addEventListener('touchend',   onPointerUp,   {passive:true});
  canvas.addEventListener('mousedown',  onPointerDown);
  window.addEventListener('mousemove',  onPointerMove);
  window.addEventListener('mouseup',    onPointerUp);

  document.body.addEventListener('touchmove', (e)=>{ if(state.running) e.preventDefault(); }, {passive:false});

  startBtn.addEventListener('click', () => startGame());

  // ===== Collision =====
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ===== Drawing =====
  function drawBackground() {
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 70; i++) {
      const x = (i * 997) % W;
      const y = (i * 571) % Math.floor(H * 0.65);
      const r = ((i * 37) % 3) + 1;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, H*0.86, W, H*0.14);
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    const W = canvas.width;

    p.targetX = clamp(p.targetX, p.w*0.5, W - p.w*0.5);
    p.x += (p.targetX - p.x) * 0.18;

    const x = p.x - p.w/2;
    const y = p.y - p.h/2;

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.h*0.45, p.w*0.46, p.h*0.12, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    if (imgChar.complete && imgChar.naturalWidth > 0) ctx.drawImage(imgChar, x, y, p.w, p.h);
    else {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x, y, p.w, p.h);
      ctx.restore();
    }
  }

  function drawEntity(ent) {
    const size = ent.size;
    const x = ent.x - size/2;
    const y = ent.y - size/2;
    const img = ent.type === 'gift' ? imgGift : imgBomb;

    if (ent.type === 'gift') {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, size*0.70, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255, 224, 102, 1)';
      ctx.fill();
      ctx.restore();
    }

    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x, y, size, size);
    else {
      ctx.save();
      ctx.fillStyle = ent.type === 'gift' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.65)';
      ctx.fillRect(x, y, size, size);
      ctx.restore();
    }
  }

  function draw() {
    resize();
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    drawBackground();
    for (const ent of state.entities) drawEntity(ent);
    drawPlayer();
  }

  // ===== Loop =====
  let last = performance.now();

  function step(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (state.running) {
      state.t += dt;

      state.speed = 1.0 + Math.min(2.2, state.t * 0.18);
      const spawnInterval = Math.max(0.22, 0.70 - state.t * 0.03);

      state.spawnTimer += dt;
      if (state.spawnTimer >= spawnInterval) { state.spawnTimer = 0; spawn(); }

      const H = canvas.height;
      const p = state.player;
      const px = p.x - p.w/2;
      const py = p.y - p.h/2;

      for (const ent of state.entities) ent.y += ent.vy * (dt * 60);

      for (let i = state.entities.length - 1; i >= 0; i--) {
        const ent = state.entities[i];
        const ex = ent.x - ent.size/2;
        const ey = ent.y - ent.size/2;

        if (aabb(px, py, p.w, p.h, ex, ey, ent.size, ent.size)) {
          if (ent.type === 'gift') {
            state.score += 1;
            scoreEl.textContent = String(state.score);
            beep(880, 0.05, 'square', 0.04);
            showToast('+1 🎁');
          } else {
            state.lives -= 1;
            livesEl.textContent = String(state.lives);
            boom();
            showToast('💣 -1');
            if (state.lives <= 0) {
              state.entities.splice(i, 1);
              endGame();
              break;
            }
          }
          state.entities.splice(i, 1);
          continue;
        }

        if (ent.y - ent.size/2 > H + ent.size) state.entities.splice(i, 1);
      }
    }

    draw();
    requestAnimationFrame(step);
  }

  resetGame();
  requestAnimationFrame(step);

})();