'use strict';

// ─── LEVEL CONFIGS ────────────────────────────────────────
const LEVELS = {
  1: {
    label:'Рівень 1 — Легкий', color:'#4caf50',
    MR:15, MC:15, EN:6, BOSS:false,
    ES:1.7, EH:2, ED:8, PHP:150, AMMO:12,
    FOG_N:12, FOG_F:50, AMB:1.4, TORCHES:8, PICKUPS:3,
    tasks:[
      { icon:'🎯', text:'Знищ 3 вороги',          type:'kill',      count:3         },
      { icon:'💀', text:'Знищ всіх ворогів',       type:'killAll'                    },
      { icon:'🟢', text:'Знайди вихід',             type:'exit'                       },
    ]
  },
  2: {
    label:'Рівень 2 — Середній', color:'#ff9800',
    MR:19, MC:19, EN:11, BOSS:true,
    ES:2.4, EH:3, ED:12, PHP:100, AMMO:10,
    FOG_N:6, FOG_F:28, AMB:1.0, TORCHES:5, PICKUPS:4,
    tasks:[
      { icon:'⚡', text:'Знищ 2 вороги за 8 сек',  type:'speedKill', count:2, win:8  },
      { icon:'🎯', text:'Знищ 6 ворогів',           type:'kill',      count:6         },
      { icon:'👑', text:'Знищ Ватажка!',            type:'killBoss'                   },
      { icon:'💀', text:'Знищ всіх ворогів',        type:'killAll'                    },
      { icon:'🟢', text:'Знайди вихід',             type:'exit'                       },
    ]
  },
  3: {
    label:'Рівень 3 — Важкий', color:'#f44336',
    MR:23, MC:23, EN:17, BOSS:true,
    ES:3.2, EH:4, ED:18, PHP:75, AMMO:8,
    FOG_N:3, FOG_F:16, AMB:0.45, TORCHES:3, PICKUPS:4,
    tasks:[
      { icon:'⚡', text:'Знищ 3 вороги за 12 сек', type:'speedKill', count:3, win:12 },
      { icon:'🎯', text:'Знищ 10 ворогів',          type:'kill',      count:10        },
      { icon:'💀', text:'Знищ Боса!',               type:'killBoss'                   },
      { icon:'☠',  text:'Знищ ВСІХ ворогів',        type:'killAll'                    },
      { icon:'🟢', text:'Знайди вихід',             type:'exit'                       },
    ]
  }
};

// ─── STATE ────────────────────────────────────────────────
let scene, cam, ren;
let maze, MR, MC;
const CELL = 4, WH = 3;
let lvCfg;
let enemies = [], pickups = [];
let totalEn = 0, killed = 0;
let hp, ammo;
let running = false, over = false;
let yaw = 0, pitch = 0, mdx = 0, mdy = 0;
const keys = {};
let scd = 0;
let audioCtx;
let startTime;

// task state
let tasks = [], taskIdx = 0, tasksDone = 0;
let killStamps = [];
let bossKilled = false;

// ─── MAZE GEN (recursive backtracker) ────────────────────
function genMaze(R, C) {
  const g = Array.from({ length: R }, () => new Array(C).fill(1));
  const D = [[0,2],[2,0],[0,-2],[-2,0]];

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = 0 | Math.random() * (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function carve(r, c) {
    const d = [...D]; shuffle(d);
    for (const [dr, dc] of d) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < R - 1 && nc > 0 && nc < C - 1 && g[nr][nc] === 1) {
        g[r + dr / 2][c + dc / 2] = 0;
        g[nr][nc] = 0;
        carve(nr, nc);
      }
    }
  }

  g[1][1] = 0;
  carve(1, 1);
  return g;
}

// ─── AUDIO ────────────────────────────────────────────────
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function sfxShoot() {
  if (!audioCtx) return;
  const len = (audioCtx.sampleRate * 0.09) | 0;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.28;
  src.connect(gain); gain.connect(audioCtx.destination); src.start();
}

function sfxTone(freq, dur, vol = 0.14, type = 'sawtooth') {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.15, audioCtx.currentTime + dur);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}

function sfxWin() {
  if (!audioCtx) return;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.13);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.13 + 0.4);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * 0.13);
    osc.stop(audioCtx.currentTime + i * 0.13 + 0.5);
  });
}

// ─── TEXTURES ─────────────────────────────────────────────
function mkWallTex() {
  const cv = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const x = cv.getContext('2d');
  x.fillStyle = '#5e6880'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#2d3445'; x.lineWidth = 2;
  for (let r = 0; r < 8; r++) {
    const off = (r % 2) * 16;
    x.beginPath(); x.moveTo(0, r * 16); x.lineTo(128, r * 16); x.stroke();
    for (let c = 0; c < 9; c++) {
      x.beginPath(); x.moveTo(c * 32 + off, r * 16); x.lineTo(c * 32 + off, (r + 1) * 16); x.stroke();
    }
  }
  const id = x.getImageData(0, 0, 128, 128);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 28;
    id.data[i]     = Math.max(0, Math.min(255, id.data[i]     + n));
    id.data[i + 1] = Math.max(0, Math.min(255, id.data[i + 1] + n));
    id.data[i + 2] = Math.max(0, Math.min(255, id.data[i + 2] + n));
  }
  x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mkFloorTex() {
  const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  const x = cv.getContext('2d');
  x.fillStyle = '#252525'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#1a1a1a'; x.lineWidth = 0.5;
  for (let i = 0; i < 64; i += 8) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ─── SCENE BUILD ──────────────────────────────────────────
function buildScene() {
  const wallMat  = new THREE.MeshLambertMaterial({ map: mkWallTex() });
  const floorMat = new THREE.MeshLambertMaterial({ map: mkFloorTex() });
  const ceilMat  = new THREE.MeshLambertMaterial({ color: 0x0e0e1a });

  for (let r = 0; r < MR; r++) {
    for (let c = 0; c < MC; c++) {
      const x = c * CELL + CELL / 2, z = r * CELL + CELL / 2;

      if (maze[r][c] === 1) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(CELL, WH, CELL), wallMat);
        wall.position.set(x, WH / 2, z);
        scene.add(wall);
      }

      const pg    = new THREE.PlaneGeometry(CELL, CELL);
      const floor = new THREE.Mesh(pg, floorMat);
      floor.rotation.x = -Math.PI / 2; floor.position.set(x, 0, z); scene.add(floor);
      const ceil  = new THREE.Mesh(pg.clone(), ceilMat);
      ceil.rotation.x  =  Math.PI / 2; ceil.position.set(x, WH, z);  scene.add(ceil);
    }
  }

  // Exit portal
  const ex = (MC - 2) * CELL + CELL / 2;
  const ez = (MR - 2) * CELL + CELL / 2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.13, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  ring.position.set(ex, 1.55, ez); ring.userData.spin = 1; scene.add(ring);

  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 28),
    new THREE.MeshBasicMaterial({ color: 0x00ffbb, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
  );
  disk.position.set(ex, 1.55, ez); scene.add(disk);

  const exitLight = new THREE.PointLight(0x00ff88, 2.8, 14);
  exitLight.position.set(ex, 1.55, ez); scene.add(exitLight);

  // Torches
  let placed = 0;
  for (let r = 1; r < MR - 1 && placed < lvCfg.TORCHES; r += 2) {
    for (let c = 1; c < MC - 1 && placed < lvCfg.TORCHES; c += 2) {
      if (maze[r][c] === 0 && Math.random() < 0.45) {
        const torch = new THREE.PointLight(0xff6600, 1.1, 12);
        torch.position.set(c * CELL + CELL / 2, 2.2, r * CELL + CELL / 2);
        scene.add(torch); placed++;
      }
    }
  }

  placePickups();
}

// ─── PICKUPS ──────────────────────────────────────────────
function placePickups() {
  const cells  = openCells(4);
  const mat    = new THREE.MeshBasicMaterial({ color: 0x00ff44 });

  for (let i = 0; i < Math.min(lvCfg.PICKUPS, cells.length); i++) {
    const [r, c] = cells[i];
    const x = c * CELL + CELL / 2, z = r * CELL + CELL / 2;
    const grp = new THREE.Group();
    const v  = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6,  0.28), mat);
    const h  = new THREE.Mesh(new THREE.BoxGeometry(0.6,  0.28, 0.28), mat);
    v.position.y = 0.4; h.position.y = 0.4;
    grp.add(v, h); grp.position.set(x, 0, z); scene.add(grp);

    const light = new THREE.PointLight(0x00ff44, 0.8, 4);
    light.position.set(x, 0.4, z); scene.add(light);

    pickups.push({ mesh: grp, light, active: true, r, c });
  }
}

function checkPickups() {
  pickups.forEach(p => {
    if (!p.active) return;
    const dx = cam.position.x - p.mesh.position.x;
    const dz = cam.position.z - p.mesh.position.z;
    if (Math.hypot(dx, dz) < 1.1) {
      p.active = false;
      scene.remove(p.mesh); scene.remove(p.light);
      hp = Math.min(lvCfg.PHP, hp + 40); updateHP();
      pop('❤ +40 HP!', '#0f8', 2200);
      sfxTone(600, 0.18, 0.12, 'sine');
    }
  });
}

// ─── ENEMIES ──────────────────────────────────────────────
function placeEnemies() {
  const cells = openCells(4);
  let idx = 0;
  const cnt = Math.min(lvCfg.EN, cells.length);
  for (let i = 0; i < cnt; i++) { spawnEnemy(cells[idx][0], cells[idx][1], false); idx++; }
  if (lvCfg.BOSS && idx < cells.length) spawnEnemy(cells[idx][0], cells[idx][1], true);
  totalEn = enemies.length;
  document.getElementById('ec').textContent = totalEn;
}

function spawnEnemy(row, col, isBoss) {
  const sc   = isBoss ? 1.6 : 1;
  const rm   = new THREE.MeshLambertMaterial({ color: isBoss ? 0x9900cc : 0xbb1100 });
  const dm   = new THREE.MeshLambertMaterial({ color: isBoss ? 0x550077 : 0x660000 });
  const em   = new THREE.MeshBasicMaterial ({ color: isBoss ? 0xff00ff : 0xff3300 });
  const grp  = new THREE.Group();

  const addBox = (w, h, d, mat, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.y = y; grp.add(m);
  };

  addBox(0.6 * sc, 1.1 * sc, 0.46 * sc, rm, 0.85 * sc);  // body
  addBox(0.52* sc, 0.52* sc, 0.52* sc, rm, 1.62 * sc);  // head

  [-.14, .14].forEach(ox => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * sc, 6, 6), em);
    eye.position.set(ox * sc, 1.68 * sc, -0.27 * sc); grp.add(eye);
  });
  [-.42, .42].forEach(ox => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17 * sc, 0.72 * sc, 0.17 * sc), dm);
    arm.position.set(ox * sc, 0.72 * sc, 0); grp.add(arm);
  });
  [-.18, .18].forEach(ox => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18 * sc, 0.62 * sc, 0.18 * sc), dm);
    leg.position.set(ox * sc, 0.2 * sc, 0); grp.add(leg);
  });

  if (isBoss) {
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const crown   = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.72), goldMat);
    crown.position.y = 2.07 * sc; grp.add(crown);
    [-.24, 0, .24].forEach(ox => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), goldMat);
      spike.position.set(ox, 2.22 * sc, 0); grp.add(spike);
    });
  }

  const eyeLight = new THREE.PointLight(isBoss ? 0xcc00ff : 0xff2200, isBoss ? 1.3 : 0.55, isBoss ? 6 : 3.5);
  eyeLight.position.set(0, 1.68 * sc, -0.3 * sc); grp.add(eyeLight);

  grp.position.set(col * CELL + CELL / 2, 0, row * CELL + CELL / 2);
  scene.add(grp);

  enemies.push({
    mesh: grp,
    hp: isBoss ? lvCfg.EH * 3 : lvCfg.EH,
    alive: true, dying: false, isBoss,
    speed: isBoss ? lvCfg.ES * 1.4 : lvCfg.ES * (0.75 + Math.random() * 0.55),
    atkCd: 0, patAngle: Math.random() * Math.PI * 2, patTimer: 0, hitFlash: 0, sc,
  });
}

// ─── HELPERS ──────────────────────────────────────────────
function openCells(minDist = 0) {
  const list = [];
  for (let r = 1; r < MR - 1; r++) {
    for (let c = 1; c < MC - 1; c++) {
      if (maze[r][c] === 0 && Math.hypot(r - 1, c - 1) > minDist) list.push([r, c]);
    }
  }
  for (let i = list.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function cellAt(x, z) {
  const c = 0 | (x / CELL), r = 0 | (z / CELL);
  if (r < 0 || r >= MR || c < 0 || c >= MC) return 1;
  return maze[r][c];
}

function slideMove(pos, dx, dz, radius) {
  if (Math.abs(dx) > 0.0001) {
    const s = dx > 0 ? radius : -radius;
    if (cellAt(pos.x + dx + s, pos.z) !== 1) pos.x += dx;
  }
  if (Math.abs(dz) > 0.0001) {
    const s = dz > 0 ? radius : -radius;
    if (cellAt(pos.x, pos.z + dz + s) !== 1) pos.z += dz;
  }
}

// ─── TASK SYSTEM ──────────────────────────────────────────
function initTasks() {
  tasks     = lvCfg.tasks.map(t => ({ ...t, done: false }));
  taskIdx   = 0; tasksDone = 0; killStamps = []; bossKilled = false;
  renderTasks(); updateHUD();
}

function checkTasks() {
  if (taskIdx >= tasks.length) return;
  const t = tasks[taskIdx];
  let done = false;
  switch (t.type) {
    case 'kill':      done = killed >= t.count; break;
    case 'speedKill': done = recentKills(t.win) >= t.count; break;
    case 'killBoss':  done = bossKilled; break;
    case 'killAll':   done = killed >= totalEn; break;
    case 'exit':      break; // handled in checkExit()
  }
  if (done) advanceTask();
}

function recentKills(winSec) {
  const now = performance.now(), win = winSec * 1000;
  return killStamps.filter(t => now - t < win).length;
}

function advanceTask() {
  tasks[taskIdx].done = true; tasksDone++;
  pop('✅ ' + tasks[taskIdx].text, '#0f8', 3000);
  sfxTone(700, 0.2, 0.12, 'sine');
  taskIdx++; killStamps = [];
  renderTasks(); updateHUD();
  checkTasks(); // cascade: перевіряємо наступне завдання одразу
}

function renderTasks() {
  const el = document.getElementById('tasks-list');
  el.innerHTML = '';
  tasks.forEach((t, i) => {
    const div   = document.createElement('div');
    const state = t.done ? 'done' : i === taskIdx ? 'active' : 'locked';
    const icon  = t.done ? '✅'  : i === taskIdx ? t.icon   : '🔒';
    div.className = 'task-item ' + state;
    div.innerHTML = `<span class="task-icon">${icon}</span><span class="task-text">${t.text}</span>`;
    el.appendChild(div);
  });
}

// Speed-kill progress bar (called every frame)
function updateSpeedKillUI() {
  const wrap = document.getElementById('speed-wrap');
  if (taskIdx >= tasks.length || tasks[taskIdx].type !== 'speedKill') {
    wrap.style.display = 'none'; return;
  }
  wrap.style.display = 'block';
  const t      = tasks[taskIdx];
  const now    = performance.now(), win = t.win * 1000;
  const recent = killStamps.filter(s => now - s < win);
  const pct    = Math.min(100, recent.length / t.count * 100);

  document.getElementById('speed-fill').style.width      = pct + '%';
  document.getElementById('speed-fill').style.background = pct >= 100 ? '#0f0' : pct > 50 ? '#fa0' : '#f55';

  let lbl = `⚡ Швидко: ${recent.length}/${t.count} за ${t.win}с`;
  if (recent.length > 0) {
    const oldest  = Math.min(...recent);
    const rem     = Math.max(0, (win - (now - oldest)) / 1000).toFixed(1);
    lbl += ` — залишилось ${rem}с`;
  }
  document.getElementById('speed-label').textContent = lbl;
}

// ─── SHOOTING ─────────────────────────────────────────────
const ray = new THREE.Raycaster();

function shoot() {
  if (!running || over || scd > 0) return;
  if (ammo <= 0) { sfxTone(110, 0.05, 0.08, 'square'); return; }

  ammo--; scd = 0.14; updateAmmo(); sfxShoot();

  const flash = new THREE.PointLight(0xffaa00, 7, 8);
  flash.position.copy(cam.position); scene.add(flash);
  setTimeout(() => scene.remove(flash), 65);

  ray.setFromCamera(new THREE.Vector2(0, 0), cam);
  const targets = [];
  enemies.forEach(e => { if (e.alive) e.mesh.traverse(o => targets.push(o)); });
  const hits = ray.intersectObjects(targets);
  if (!hits.length) return;

  const hitChild = hits[0].object;
  const enemy = enemies.find(e => {
    let found = false;
    e.mesh.traverse(o => { if (o === hitChild) found = true; });
    return found;
  });
  if (!enemy || !enemy.alive) return;

  enemy.hp--; enemy.hitFlash = 0.12;
  sfxTone(280, 0.12, 0.09);
  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(e) {
  e.alive = false; e.dying = true; killed++;
  if (e.isBoss) {
    bossKilled = true;
    pop('👑 Ватажка знищено!', '#fa0', 3500);
    sfxTone(200, 0.5, 0.2, 'sawtooth');
  } else {
    sfxTone(140, 0.3, 0.13, 'square');
  }
  setTimeout(() => scene.remove(e.mesh), 900);
  killStamps.push(performance.now());
  checkTasks();
  updateHUD();
}

// ─── ENEMY AI ─────────────────────────────────────────────
function updateEnemies(dt) {
  const px = cam.position.x, pz = cam.position.z;

  enemies.forEach(e => {
    if (e.dying) { e.mesh.rotation.z += dt * 3.5; e.mesh.position.y -= dt; return; }
    if (!e.alive) return;

    if (e.hitFlash > 0) {
      e.hitFlash -= dt;
      e.mesh.traverse(o => {
        if (o.isMesh && o.material.emissive)
          o.material.emissive.setHex(e.hitFlash > 0 ? 0x993300 : 0x000000);
      });
    }

    const ex = e.mesh.position.x, ez = e.mesh.position.z;
    const dx = px - ex, dz = pz - ez, dist = Math.hypot(dx, dz);

    if (dist < 15) {
      e.mesh.lookAt(px, e.mesh.position.y, pz);
      if (dist > 1.2 * e.sc) slideMove(e.mesh.position, dx / dist * e.speed * dt, dz / dist * e.speed * dt, 0.3);
      if (dist < 1.35 * e.sc) {
        e.atkCd -= dt;
        if (e.atkCd <= 0) {
          e.atkCd = e.isBoss ? 0.75 : 1.3;
          hurtPlayer(lvCfg.ED * (e.isBoss ? 2 : 1));
        }
      }
    } else {
      e.patTimer -= dt;
      if (e.patTimer <= 0) { e.patAngle += (Math.random() - 0.5) * Math.PI; e.patTimer = 1 + Math.random() * 2.5; }
      const bx = e.mesh.position.x, bz = e.mesh.position.z;
      slideMove(e.mesh.position, Math.cos(e.patAngle) * e.speed * 0.22 * dt, Math.sin(e.patAngle) * e.speed * 0.22 * dt, 0.3);
      if (e.mesh.position.x === bx && e.mesh.position.z === bz) e.patAngle += Math.PI * 0.65;
    }

    e.mesh.position.y = Math.sin(performance.now() * 0.0025 + ex) * 0.04 * (e.isBoss ? 0.6 : 1);
  });
}

// ─── PLAYER ───────────────────────────────────────────────
function hurtPlayer(dmg) {
  hp = Math.max(0, hp - dmg);
  sfxTone(75, 0.22, 0.18, 'square');
  const d = document.getElementById('dmg');
  d.style.opacity = '0.45'; setTimeout(() => d.style.opacity = '0', 130);
  updateHP();
  if (hp <= 0) endGame(false);
}

function movePlayer(dt) {
  const spd = (keys.ShiftLeft || keys.ShiftRight ? 7 : 4.2) * dt;
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp)    mz = -1;
  if (keys.KeyS || keys.ArrowDown)  mz =  1;
  if (keys.KeyA || keys.ArrowLeft)  mx = -1;
  if (keys.KeyD || keys.ArrowRight) mx =  1;

  if (mx || mz) {
    const len = Math.hypot(mx, mz); mx /= len; mz /= len;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    slideMove(cam.position, (cos * mx + sin * mz) * spd, (-sin * mx + cos * mz) * spd, 0.32);
  }

  yaw   -= mdx * 0.002;
  pitch -= mdy * 0.002;
  pitch  = Math.max(-1.05, Math.min(1.05, pitch));
  mdx = mdy = 0;

  cam.rotation.order = 'YXZ';
  cam.rotation.y = yaw;
  cam.rotation.x = pitch;
  scd = Math.max(0, scd - dt);
}

// ─── WIN CHECK ────────────────────────────────────────────
function checkExit() {
  if (taskIdx >= tasks.length || tasks[taskIdx].type !== 'exit') return;
  const pc = 0 | (cam.position.x / CELL);
  const pr = 0 | (cam.position.z / CELL);
  if (pr === MR - 2 && pc === MC - 2) endGame(true);
}

// ─── UI ───────────────────────────────────────────────────
function updateHUD() {
  updateHP(); updateAmmo();
  document.getElementById('ec').textContent = Math.max(0, totalEn - killed);
  document.getElementById('kc').textContent = killed;
  if (taskIdx < tasks.length) {
    const t = tasks[taskIdx];
    const el = document.getElementById('obj-text');
    el.textContent = t.icon + ' ' + t.text;
    el.style.color  = t.type === 'exit' ? '#0f8' : '#fa0';
  }
}

function updateHP() {
  document.getElementById('hp-val').textContent = hp;
  const bar = document.getElementById('hp-bar');
  bar.style.width      = Math.max(0, hp) / lvCfg.PHP * 100 + '%';
  bar.style.background = hp > 60 ? '#0f0' : hp > 30 ? '#fa0' : '#f22';
}

function updateAmmo() {
  document.getElementById('ammo-val').textContent = `${ammo} / ∞`;
}

let popTO;
function pop(txt, color = '#0f8', dur = 2600) {
  const el = document.getElementById('pop');
  el.textContent   = txt;
  el.style.color   = color;
  el.style.textShadow = `0 0 10px ${color}`;
  el.style.opacity = '1';
  clearTimeout(popTO);
  popTO = setTimeout(() => el.style.opacity = '0', dur);
}

// ─── MINIMAP ──────────────────────────────────────────────
function drawMM() {
  const cv  = document.getElementById('mm');
  const ctx = cv.getContext('2d');
  const cw  = cv.width, cs = cw / Math.max(MR, MC);

  ctx.clearRect(0, 0, cw, cw);
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, cw, cw);

  for (let r = 0; r < MR; r++) {
    for (let c = 0; c < MC; c++) {
      if (maze[r][c] === 1) { ctx.fillStyle = '#3a4060'; ctx.fillRect(c * cs, r * cs, cs - 0.2, cs - 0.2); }
    }
  }

  // Exit
  ctx.fillStyle = '#00ff88'; ctx.fillRect((MC - 2) * cs, (MR - 2) * cs, cs, cs);

  // Pickups
  pickups.forEach(p => {
    if (!p.active) return;
    ctx.fillStyle = '#00ff44'; ctx.fillRect(p.c * cs + 0.5, p.r * cs + 0.5, cs - 1, cs - 1);
  });

  // Enemies
  enemies.forEach(e => {
    if (!e.alive) return;
    ctx.fillStyle = e.isBoss ? '#cc00ff' : '#ff2200';
    const ec = e.mesh.position.x / CELL, er = e.mesh.position.z / CELL;
    ctx.fillRect(ec * cs + 0.5, er * cs + 0.5, cs - 1, cs - 1);
  });

  // Player dot + direction
  const px = cam.position.x / CELL, pz = cam.position.z / CELL;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px * cs, pz * cs, cs * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(px * cs, pz * cs);
  ctx.lineTo(px * cs - Math.sin(yaw) * cs * 1.9, pz * cs - Math.cos(yaw) * cs * 1.9); ctx.stroke();
}

// ─── END GAME ─────────────────────────────────────────────
function endGame(win) {
  running = false; over = true; document.exitPointerLock();
  if (win) sfxWin();

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;

  document.getElementById('end-overlay').style.display = 'flex';
  document.getElementById('end-title').textContent  = win ? '🏆 ПЕРЕМОГА!'                          : '💀 ПОРАЗКА';
  document.getElementById('end-title').style.color  = win ? '#0f8'                                  : '#f22';
  document.getElementById('end-sub').textContent    = win ? 'Ти виконав усі завдання і знайшов вихід!' : 'Тебе знищили вороги. Спробуй ще раз!';
  document.getElementById('end-stats').textContent  = `${lvCfg.label} | Час: ${mm}хв ${ss}с | Вбито: ${killed}/${totalEn}`;
  document.getElementById('end-tasks').textContent  = `Завдань виконано: ${tasksDone}/${tasks.length}`;
}

// ─── MAIN LOOP ────────────────────────────────────────────
let prev = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - prev) / 1000, 0.05); prev = now;

  if (running && !over) {
    movePlayer(dt);
    updateEnemies(dt);
    updateSpeedKillUI();
    checkExit();
    checkPickups();
    scene.traverse(o => { if (o.userData.spin) o.rotation.y += dt * 0.75; });
    drawMM();
  }

  ren.render(scene, cam);
}

// ─── START GAME ───────────────────────────────────────────
function startGame(level) {
  initAudio();
  lvCfg = LEVELS[level];
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('lv-badge').textContent  = lvCfg.label;
  document.getElementById('lv-badge').style.color  = lvCfg.color;

  MR = lvCfg.MR; MC = lvCfg.MC;
  maze    = genMaze(MR, MC);
  enemies = []; pickups = [];
  hp      = lvCfg.PHP; ammo = lvCfg.AMMO;
  killed  = 0; over = false; running = false;
  yaw     = 0; pitch = 0; scd = 0; bossKilled = false;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0e1a);
  scene.fog        = new THREE.Fog(0x0e0e1a, lvCfg.FOG_N, lvCfg.FOG_F);

  cam = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 200);
  cam.position.set(CELL * 1.5, 1.65, CELL * 1.5);

  ren = new THREE.WebGLRenderer({ antialias: true });
  ren.setPixelRatio(Math.min(devicePixelRatio, 2));
  ren.setSize(innerWidth, innerHeight);
  document.body.insertBefore(ren.domElement, document.getElementById('ui'));

  scene.add(new THREE.AmbientLight(0x2a3055, lvCfg.AMB));
  const playerLight = new THREE.PointLight(0xffeedd, 0.45, 9);
  cam.add(playerLight); scene.add(cam);

  buildScene();
  placeEnemies();
  initTasks();
  updateHUD();

  startTime = Date.now();
  document.body.addEventListener('click', () => {
    if (running && !over && !document.pointerLockElement) document.body.requestPointerLock();
  });
  document.body.requestPointerLock();
  running = true;
  requestAnimationFrame(loop);
}

// ─── INPUT ────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!running) return;
  if (e.code === 'KeyR') { ammo = lvCfg.AMMO; updateAmmo(); }
  if (e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); shoot(); }
});
document.addEventListener('keyup',      e => { keys[e.code] = false; });
document.addEventListener('mousemove',  e => { if (document.pointerLockElement) { mdx += e.movementX; mdy += e.movementY; } });
document.addEventListener('mousedown',  e => { if (e.button === 0) shoot(); });
window.addEventListener('resize', () => {
  if (!cam) return;
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  ren.setSize(innerWidth, innerHeight);
});
