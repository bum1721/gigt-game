(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const bestEl  = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const startBtn= document.getElementById('startBtn');
  const toast   = document.getElementById('toast');

  // ====== Helpers ======
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 900);
  }

  // High score
  const BEST_KEY = 'gift_catch_best_v1';
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best.toString();

  // DPI safe resize
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

  // Assets
  const imgChar = new Image(); imgChar.src = 'assets/character.png';
  const imgGift = new Image(); imgGift.src = 'assets/gift.png';
  const imgCoal = new Image(); imgCoal.src = 'assets/coal.png';

  // ====== Game State ======
  const state = {
    running: false,
    t: 0,
    score: 0,
    lives: 3,
    speed: 1.0,
    spawnTimer: 0,
    entities: [],
    // player (in logical pixels = canvas px)
    player: { x: 0, y: 0, w: 120, h: 160, targetX: 0, vx: 0 }
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
    // scale player based on screen
    const base = Math.min(W, H);
    p.h = Math.floor(base * 0.26);
    p.w = Math.floor(p.h * 0.68);
    p.x = Math.floor(W * 0.5);
    p.targetX = p.x;
    p.y = Math.floor(H - p.h * 0.62);
    p.vx = 0;

    scoreEl.textContent = '0';
    livesEl.textContent = '3';
  }

  function startGame() {
    resetGame();
    overlay.classList.remove('show');
    state.running = true;
    showToast('선물 떨어집니다! 🎁');
  }

  function endGame() {
    state.running = false;
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = String(best);
      showToast('최고기록 갱신! ✨');
    }
    // Show overlay again with result
    overlay.classList.add('show');
    overlay.querySelector('h1').textContent = '게임 오버';
    overlay.querySelector('p').innerHTML =
      `점수: <b>${state.score}</b> &nbsp;|&nbsp; 최고: <b>${best}</b><br/>다시 도전해볼까요?`;
    startBtn.textContent = '다시 시작';
  }

  // ====== Spawning ======
  function spawn() {
    const W = canvas.width, H = canvas.height;
    const base = Math.min(W, H);
    const size = Math.floor(base * 0.10); // entity size
    const x = Math.floor(Math.random() * (W - size) + size/2);
    const y = -size;
    const isCoal = Math.random() < Math.min(0.25 + state.score * 0.0015, 0.55); // harder over time
    const vy = (2.2 + Math.random() * 1.2) * state.speed * (W/900); // scale
    state.entities.push({ x, y, size, vy, type: isCoal ? 'coal' : 'gift' });
  }

  // ====== Controls (touch drag / tap) ======
  let pointerDown = false;
  let lastTapTime = 0;

  function clientToCanvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    return (clientX - rect.left) * dpr;
  }

  function onPointerDown(e) {
    pointerDown = true;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const x = clientToCanvasX(cx);
    state.player.targetX = x;

    const now = performance.now();
    // If quick tap (no drag), nudge
    if (now - lastTapTime < 280) {
      // double tap: center
      state.player.targetX = canvas.width * 0.5;
      showToast('가운데로! ✅');
    }
    lastTapTime = now;
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const x = clientToCanvasX(cx);
    state.player.targetX = x;
  }
  function onPointerUp() { pointerDown = false; }

  canvas.addEventListener('touchstart', onPointerDown, {passive:false});
  canvas.addEventListener('touchmove',  onPointerMove, {passive:false});
  canvas.addEventListener('touchend',   onPointerUp,   {passive:true});
  canvas.addEventListener('mousedown',  onPointerDown);
  window.addEventListener('mousemove',  onPointerMove);
  window.addEventListener('mouseup',    onPointerUp);

  // Prevent page scroll on touch
  document.body.addEventListener('touchmove', (e)=>{ if(state.running) e.preventDefault(); }, {passive:false});

  startBtn.addEventListener('click', () => {
    // restore overlay title content
    overlay.querySelector('h1').textContent = '🎁 선물받기';
    startBtn.textContent = '시작';
    startGame();
  });

  // ====== Collision ======
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ====== Drawing ======
  function drawBackground() {
    const W = canvas.width, H = canvas.height;

    // stars
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 55; i++) {
      const x = (i * 997) % W;
      const y = (i * 571) % Math.floor(H * 0.65);
      const r = ((i * 37) % 3) + 1;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // ground
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, H*0.86, W, H*0.14);
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    const W = canvas.width;

    // clamp target
    p.targetX = clamp(p.targetX, p.w*0.5, W - p.w*0.5);
    // smooth follow
    p.x += (p.targetX - p.x) * 0.18;

    const x = p.x - p.w/2;
    const y = p.y - p.h/2;

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.h*0.45, p.w*0.46, p.h*0.12, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // character image
    if (imgChar.complete) {
      ctx.drawImage(imgChar, x, y, p.w, p.h);
    } else {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x, y, p.w, p.h);
      ctx.restore();
    }
  }

  function drawEntity(ent) {
    const size = ent.size;
    const x = ent.x - size/2;
    const y = ent.y - size/2;
    const img = ent.type === 'gift' ? imgGift : imgCoal;

    // small glow for gift
    if (ent.type === 'gift') {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, size*0.68, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255, 224, 102, 1)';
      ctx.fill();
      ctx.restore();
    }

    if (img.complete) ctx.drawImage(img, x, y, size, size);
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

    // entities
    for (const ent of state.entities) drawEntity(ent);

    // player
    drawPlayer();
  }

  // ====== Update Loop ======
  let last = performance.now();

  function step(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (state.running) {
      state.t += dt;

      // spawn pace gets faster
      const spawnInterval = Math.max(0.28, 0.75 - state.score * 0.003);
      state.spawnTimer += dt;
      if (state.spawnTimer >= spawnInterval) {
        state.spawnTimer = 0;
        spawn();
      }

      // speed up slowly
      state.speed = 1.0 + Math.min(1.8, state.score * 0.01);

      // update entities
      const p = state.player;
      const px = p.x - p.w/2;
      const py = p.y - p.h/2;

      for (const ent of state.entities) {
        ent.y += ent.vy * (dt * 60); // normalize to 60fps-ish
      }

      // collisions / cleanup
      for (let i = state.entities.length - 1; i >= 0; i--) {
        const ent = state.entities[i];
        const ex = ent.x - ent.size/2;
        const ey = ent.y - ent.size/2;

        if (aabb(px, py, p.w, p.h, ex, ey, ent.size, ent.size)) {
          if (ent.type === 'gift') {
            state.score += 10;
            scoreEl.textContent = String(state.score);
            showToast('+10 🎁');
          } else {
            state.lives -= 1;
            livesEl.textContent = String(state.lives);
            showToast('꽝! -1 💥');
            if (state.lives <= 0) {
              state.entities.splice(i, 1);
              endGame();
              break;
            }
          }
          state.entities.splice(i, 1);
          continue;
        }

        if (ent.y - ent.size/2 > H + ent.size) {
          // missed gift: small penalty? (optional)
          if (ent.type === 'gift' && state.score > 0) {
            state.score = Math.max(0, state.score - 2);
            scoreEl.textContent = String(state.score);
          }
          state.entities.splice(i, 1);
        }
      }
    }

    draw();
    requestAnimationFrame(step);
  }

  // Initial screen
  resetGame();
  requestAnimationFrame(step);

})();