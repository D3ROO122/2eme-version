/* ============================================================
   BLIND TEST FR — game.js
   Pas de clé API. Deezer JSONP — fonctionne partout.
   ============================================================ */

// ── PACKS D'ARTISTES ───────────────────────────────────────
const PACKS = [
  {
    id: 'tendances',
    icon: '🔥',
    label: 'Tendances',
    sublabel: 'Ce qui tourne en ce moment',
    tags: ['Werenoi', 'Gazo', 'Tiakola', 'Hamza', 'SDM'],
    color: '#ff6b35',
    queries: [
      'werenoi','gazo','tiakola','hamza rap','sdm rap',
      'guy2bezbar','ziak rap','leto rap','bramsito','timal rap',
      'keblack','lefa rap','freeze corleone','maes rap',
      'koba lad','doomams','ninho rap','naps marseille',
    ],
  },
  {
    id: 'marseille',
    icon: '🔵',
    label: 'Marseille',
    sublabel: 'La cité phocéenne s\'écoute',
    tags: ['Jul', 'SCH', 'Naps', 'Soso Maness'],
    color: '#4f8ef7',
    queries: [
      'jul rap','sch marseille','naps marseille','soso maness',
      'alonzo marseille','kofs rap','lacrim','koba lad marseille',
      'akhenaton iam','psy4 de la rime','kaaris',
    ],
  },
  {
    id: 'legendes',
    icon: '👑',
    label: 'Légendes',
    sublabel: 'Les OG du rap FR',
    tags: ['PNL', 'Nekfeu', 'Damso', 'Booba'],
    color: '#f0c419',
    queries: [
      'pnl duo','nekfeu rap','damso','booba','kaaris',
      'lacrim','freeze corleone','lomepal','vald rap',
      'orelsan','bigflo oli','rohff','sinik',
    ],
  },
  {
    id: 'rnb',
    icon: '💜',
    label: 'R&B / Urbain',
    sublabel: 'Son smooth pour les soirées',
    tags: ['Aya Nakamura', 'Tayc', 'Tiakola', 'Dadju'],
    color: '#a855f7',
    queries: [
      'aya nakamura','tayc','dadju','tiakola','imen es',
      'gambi','gims','slimane','vitaa','keblack',
      'soolking','naza','dystinct','kayna samet',
    ],
  },
  {
    id: 'mix',
    icon: '🎵',
    label: 'Tout mélangé',
    sublabel: 'Rap · R&B · Pop · Classiques',
    tags: [],
    color: '#9898b0',
    queries: [
      'jul rap','pnl duo','ninho rap','nekfeu rap','gazo','sch marseille',
      'damso','naps marseille','freeze corleone','maes rap',
      'werenoi','tiakola','hamza rap','sdm rap','guy2bezbar',
      'aya nakamura','tayc','dadju','gims','imen es','gambi',
      'angele','stromae','bigflo oli','orelsan','vald',
      'booba','kaaris','lomepal','bramsito','ziak rap',
    ],
  },
];

const DURATIONS = [1, 3, 5, 10, 30];
const DURATION_LABELS = { 1:'Légendaire', 3:'Expert', 5:'Normal', 10:'Facile', 30:'Débutant' };
const ROUND_COUNT = 10;

// ── SEEDED RNG ─────────────────────────────────────────────
function mkRng(seed) {
  let s = String(seed).split('').reduce((a, c) => Math.imul(a, 31) + c.charCodeAt(0) | 0, 0);
  return () => { s = Math.imul(1664525, s) + 1013904223 | 0; return (s >>> 0) / 0x100000000; };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── DAILY SEED ─────────────────────────────────────────────
function dailySeed() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

// ── STRING UTILS ───────────────────────────────────────────
function norm(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(le|la|les|l|un|une|des|du|de|d|the|a|an|feat|ft|x|vs|featuring|avec)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lev(a, b) {
  if (!a) return b.length;
  if (!b) return a.length;
  const dp = Array.from({length: a.length+1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function isCorrect(input, song) {
  const inp = norm(input);
  if (inp.length < 2) return false;
  const artist = norm(song.artist);
  const title = norm(song.title);

  // Exact match
  if (inp === artist || inp === title) return true;

  // Contains
  if (inp.length >= 3) {
    if (artist.includes(inp) || inp.includes(artist)) return true;
    if (title.includes(inp) || inp.includes(title)) return true;
  }

  // Fuzzy (levenshtein)
  const thr = inp.length <= 5 ? 1 : 2;
  if (lev(inp, artist) <= thr) return true;
  if (lev(inp, title) <= thr) return true;

  // Word-level match
  const artistWords = artist.split(' ').filter(w => w.length >= 3);
  if (artistWords.some(w => inp === w || lev(inp, w) <= 1)) return true;

  const titleWords = title.split(' ').filter(w => w.length >= 4);
  if (titleWords.some(w => inp === w || lev(inp, w) <= 1)) return true;

  return false;
}

// ── DEEZER FETCH ───────────────────────────────────────────
const cache = {};

// JSONP : fonctionne partout (file://, localhost, Vercel)
// Deezer supporte nativement output=jsonp
function deezerJSONP(q) {
  return new Promise((resolve) => {
    const cbName = 'bt' + Math.random().toString(36).slice(2, 8);
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      delete window[cbName];
      script.remove();
      resolve({ data: [] });
    }, 8000);

    window[cbName] = (data) => {
      clearTimeout(timer);
      delete window[cbName];
      script.remove();
      resolve(data);
    };

    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10&output=jsonp&callback=${cbName}`;
    script.onerror = () => { clearTimeout(timer); delete window[cbName]; resolve({ data: [] }); };
    document.head.appendChild(script);
  });
}

async function fetchQuery(q) {
  if (cache[q]) return cache[q];
  try {
    const d = await deezerJSONP(q);
    const songs = (d.data || [])
      .filter(t => t.preview && t.preview.startsWith('https'))
      .map(t => ({
        artist: t.artist.name,
        title: t.title.replace(/\(.*?\)/g, '').trim(),
        preview: t.preview,
        cover: t.album?.cover_medium || '',
        album: t.album?.title || '',
      }));
    cache[q] = songs;
    return songs;
  } catch { return []; }
}

async function buildPool(seed, packId) {
  const rng = mkRng(seed + '_q');
  const pack = PACKS.find(p => p.id === packId) || PACKS.find(p => p.id === 'mix');
  const picked = shuffle(pack.queries, rng).slice(0, Math.min(14, pack.queries.length));
  const batches = await Promise.all(picked.map(fetchQuery));
  const all = batches.flat();

  // Deduplicate by artist name to ensure variety
  const seen = new Set();
  const pool = [];
  for (const s of shuffle(all, mkRng(seed + '_d'))) {
    const key = norm(s.artist);
    if (!seen.has(key)) {
      seen.add(key);
      pool.push(s);
    }
  }

  const rng2 = mkRng(seed + '_s');
  return shuffle(pool, rng2).slice(0, ROUND_COUNT);
}

// ── HINT SYSTEM ────────────────────────────────────────────
function buildHint(str, revealCount) {
  // Show first N characters, hide rest with dots
  const normalized = str.trim();
  if (revealCount >= normalized.length) return normalized;
  return normalized.slice(0, revealCount) + '·'.repeat(Math.max(0, normalized.length - revealCount));
}

// ── URL PARAMS ─────────────────────────────────────────────
function getParams() {
  const p = new URLSearchParams(location.search);
  return {
    seed: p.get('seed'),
    challenger: p.get('c'),
    cscore: p.get('s') ? parseInt(p.get('s')) : null,
    dur: p.get('d') ? parseInt(p.get('d')) : null,
    pack: p.get('p') || null,
  };
}

function clearParams() {
  history.replaceState(null, '', location.pathname);
}

// ── STATE ──────────────────────────────────────────────────
let S = {
  screen: 'home',
  gameMode: 'random',
  duration: 3,
  pack: 'mix',
  seed: null,
  challenge: null,         // { name, score }
  nickname: localStorage.getItem('bt_nick') || 'Moi',
  songs: [],
  round: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  history: [],
  audio: null,
  timerInt: null,
  countInt: null,
  answered: false,
  canPlay: false,
  hintLevel: 0,           // 0=no hint, 1=artist hint, 2=title hint
  hasPlayed: false,        // has started listening this round
};

// ── AUDIO ──────────────────────────────────────────────────
function stopAudio() {
  clearInterval(S.timerInt);
  clearInterval(S.countInt);
  S.timerInt = S.countInt = null;
  if (S.audio) { try { S.audio.pause(); } catch(e) {} S.audio = null; }
  waveOff();
}

function playAudio(song, duration, onDone) {
  stopAudio();
  const el = new Audio(song.preview);
  el.volume = 0.85;
  el.crossOrigin = 'anonymous';
  S.audio = el;

  el.addEventListener('canplay', () => {
    // Random start between 5s and 20s to add variety
    const maxStart = Math.max(5, Math.min(20, 30 - duration - 2));
    const start = 5 + Math.floor(Math.random() * (maxStart - 5));
    el.currentTime = start;
    el.play().catch(() => {});
    waveOn();

    let rem = duration;
    updateTimer(duration, duration);

    S.countInt = setInterval(() => {
      rem--;
      updateTimer(rem, duration);
      if (rem <= 0) {
        clearInterval(S.countInt);
        stopAudio();
        if (onDone) onDone();
      }
    }, 1000);
  }, { once: true });

  el.addEventListener('error', () => {
    if (onDone) onDone();
  }, { once: true });
}

// ── WAVEFORM ───────────────────────────────────────────────
const WAVE_COUNT = 20;
function waveOn() {
  document.querySelectorAll('.wbar').forEach((b, i) => {
    b.classList.add('active');
    b.style.animationDelay = (i * 0.035) + 's';
    b.style.animationDuration = (0.4 + Math.random() * 0.3) + 's';
  });
}
function waveOff() { document.querySelectorAll('.wbar').forEach(b => b.classList.remove('active')); }

function buildWaveform() {
  return Array.from({length: WAVE_COUNT}, (_, i) => {
    const t = i / WAVE_COUNT;
    const h = 8 + 40 * Math.sin(Math.PI * t);
    return `<div class="wbar" style="height:${h}px"></div>`;
  }).join('');
}

// ── TIMER UI ───────────────────────────────────────────────
function updateTimer(rem, total) {
  const pct = total > 0 ? (rem / total) * 100 : 0;
  const fill = document.getElementById('timer-fill');
  const lbl = document.getElementById('timer-lbl');
  if (fill) {
    fill.style.width = pct + '%';
    fill.className = 'timer-fill' + (pct < 30 ? ' danger' : '');
  }
  if (lbl) lbl.textContent = rem > 0 ? `${rem}s` : '⏱ Tape ta réponse !';
}

// ── RENDER ─────────────────────────────────────────────────
const app = document.getElementById('app');
const qs = sel => document.querySelector(sel);

function render() {
  switch (S.screen) {
    case 'home':    renderHome();    break;
    case 'config':  renderConfig();  break;
    case 'loading': renderLoading(); break;
    case 'game':    renderGame();    break;
    case 'result':  renderResult();  break;
  }
}

// ─ HOME ───────────────────────────────────────────────────
function renderHome() {
  const p = getParams();
  const hasChal = p.challenger && p.cscore != null && p.seed;

  app.innerHTML = `
    <div class="site-logo">
      <h1>Blind Test FR</h1>
      <p>Devine les artistes et chansons en quelques secondes</p>
    </div>
    <div class="home-wrap">
      ${hasChal ? `
        <div class="challenge-banner">
          <span>🎯</span>
          <span><strong>${esc(p.challenger)}</strong> te défie — score à battre : <strong>${p.cscore}/${ROUND_COUNT}</strong></span>
        </div>
      ` : ''}

      <button class="daily-card" id="btn-daily">
        <div class="daily-card-top">
          <div class="daily-dot"></div>
          <span class="t-label">Défi du jour</span>
        </div>
        <div style="font-size:15px;font-weight:500;color:var(--text)">Même musiques pour tout le monde aujourd'hui</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:4px">Compare ton score avec tes potes ↗</div>
      </button>

      <div class="section-label" style="margin-top:1rem">Modes de jeu</div>
      <div class="mode-grid">
        <button class="mode-card" id="btn-random">
          <span class="mode-card-icon">🎲</span>
          <h3>Aléatoire</h3>
          <p>Nouvelles musiques à chaque partie</p>
        </button>
        <button class="mode-card" id="btn-versus">
          <span class="mode-card-icon">⚔️</span>
          <h3>Défi ami</h3>
          <p>Joue puis envoie ton lien</p>
        </button>
      </div>

      ${hasChal ? `
        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:.5rem" id="btn-accept">
          Accepter le défi de ${esc(p.challenger)} 🎯
        </button>
      ` : ''}

      <div class="section-label" style="margin-top:1.5rem">Ton pseudo</div>
      <input class="nick-input" id="nick-inp" placeholder="Ton pseudo (pour les défis)" value="${esc(S.nickname)}" maxlength="20">
    </div>
  `;

  qs('#nick-inp').addEventListener('input', e => {
    S.nickname = e.target.value.trim() || 'Moi';
    localStorage.setItem('bt_nick', S.nickname);
  });

  qs('#btn-daily').addEventListener('click', () => {
    S.gameMode = 'daily';
    S.seed = dailySeed();
    S.challenge = null;
    clearParams();
    goConfig();
  });

  qs('#btn-random').addEventListener('click', () => {
    S.gameMode = 'random';
    S.seed = Math.random().toString(36).slice(2, 10);
    S.challenge = null;
    clearParams();
    goConfig();
  });

  qs('#btn-versus').addEventListener('click', () => {
    S.gameMode = 'versus';
    S.seed = Math.random().toString(36).slice(2, 10);
    S.challenge = null;
    clearParams();
    goConfig();
  });

  const acceptBtn = qs('#btn-accept');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      const p = getParams();
      S.gameMode = 'versus';
      S.seed = p.seed;
      S.duration = p.dur || 3;
      S.pack = p.pack || 'mix';
      S.challenge = { name: p.challenger, score: p.cscore };
      goGame();
    });
  }
}

// ─ CONFIG ─────────────────────────────────────────────────
function goConfig() { S.screen = 'config'; render(); }

function renderConfig() {
  const modeLabels = { random: 'Aléatoire', daily: 'Défi du jour', versus: 'Défi ami' };

  app.innerHTML = `
    <div class="site-logo"><h1>Blind Test FR</h1></div>
    <div class="config-wrap">
      <button class="back-btn" id="btn-back">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Retour
      </button>

      <div class="section-label" style="margin-bottom:12px">Choisis ton pack</div>
      <div class="pack-list" id="pack-list">
        ${PACKS.map(pk => {
          const isActive = S.pack === pk.id;
          const tagsHtml = pk.tags.length
            ? pk.tags.map(t => `<span class="pack-tag">${esc(t)}</span>`).join('')
            : `<span class="pack-tag">Tous les artistes</span>`;
          return `
            <button class="pack-card ${isActive ? 'active' : ''}" data-pack="${pk.id}"
              style="--pack-color:${pk.color}">
              <div class="pack-card-left">
                <span class="pack-icon">${pk.icon}</span>
                <div>
                  <div class="pack-name">${pk.label}</div>
                  <div class="pack-sub">${pk.sublabel}</div>
                </div>
              </div>
              <div class="pack-tags">${tagsHtml}</div>
              ${isActive ? '<div class="pack-check">✓</div>' : ''}
            </button>`;
        }).join('')}
      </div>

      <div class="section-label" style="margin:1.25rem 0 10px">Durée de l'extrait</div>
      <div class="dur-grid" id="dur-grid">
        ${DURATIONS.map(d => `
          <button class="dur-btn ${S.duration === d ? 'active' : ''}" data-d="${d}">
            ${d}s
            <small>${DURATION_LABELS[d]}</small>
          </button>
        `).join('')}
      </div>
      <p style="font-size:12px;color:var(--text-3);font-style:italic;margin-bottom:1.5rem">Tu peux réécouter autant de fois que tu veux avant de répondre</p>

      <button class="btn btn-primary btn-lg" style="width:100%" id="btn-go">
        ${S.gameMode === 'versus' ? '⚔️ Jouer et créer un défi' : '▶ Commencer'}
      </button>
    </div>
  `;

  qs('#btn-back').addEventListener('click', () => { S.screen = 'home'; render(); });

  qs('#pack-list').addEventListener('click', e => {
    const b = e.target.closest('.pack-card');
    if (!b) return;
    S.pack = b.dataset.pack;
    document.querySelectorAll('.pack-card').forEach(x => {
      x.classList.remove('active');
      x.querySelector('.pack-check') && x.querySelector('.pack-check').remove();
    });
    b.classList.add('active');
    if (!b.querySelector('.pack-check')) {
      const chk = document.createElement('div');
      chk.className = 'pack-check';
      chk.textContent = '✓';
      b.appendChild(chk);
    }
  });

  qs('#dur-grid').addEventListener('click', e => {
    const b = e.target.closest('.dur-btn');
    if (!b) return;
    S.duration = parseInt(b.dataset.d);
    document.querySelectorAll('.dur-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  });

  qs('#btn-go').addEventListener('click', goGame);
}

// ─ LOADING ────────────────────────────────────────────────
function renderLoading() {
  const tips = [
    'Chargement des sons…',
    'On pioche dans les classiques…',
    'Préparation du blind test…',
    'Ça arrive, tiens bon…',
  ];
  const tip = tips[Math.floor(Math.random() * tips.length)];
  app.innerHTML = `
    <div class="site-logo"><h1>Blind Test FR</h1></div>
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <span>${tip}</span>
    </div>
  `;
}

// ─ GAME ───────────────────────────────────────────────────
async function goGame() {
  S.screen = 'loading';
  S.round = 0; S.score = 0; S.streak = 0; S.maxStreak = 0;
  S.history = []; S.answered = false; S.canPlay = false;
  S.hasPlayed = false; S.hintLevel = 0;
  render();

  S.songs = await buildPool(S.seed, S.pack);
  if (!S.songs.length) {
    alert('Impossible de charger les musiques. Vérifie ta connexion et réessaie.');
    S.screen = 'home'; render(); return;
  }

  S.screen = 'game';
  render();
}

function renderGame() {
  const song = S.songs[S.round];
  if (!song) { showResult(); return; }
  const hasChal = !!S.challenge;
  S.hintLevel = 0;
  S.hasPlayed = false;

  app.innerHTML = `
    <div class="site-logo" style="padding-bottom:0.5rem">
      <h1>Blind Test FR</h1>
    </div>
    <div class="game-wrap">
      ${hasChal ? `
        <div class="challenge-banner">
          🎯 Défi de <strong>${esc(S.challenge.name)}</strong> — score à battre : <strong>${S.challenge.score}/${ROUND_COUNT}</strong>
        </div>
      ` : ''}

      <div class="game-header">
        <div class="round-pill">Manche ${S.round + 1} / ${ROUND_COUNT}</div>
        <div class="score-wrap">
          <div class="score-item">Score <span id="ui-score">${S.score}</span></div>
          <div id="ui-streak"></div>
        </div>
      </div>

      <div class="wave-card">
        <div id="waveform">${buildWaveform()}</div>
        <div class="timer-track"><div class="timer-fill" id="timer-fill" style="width:100%"></div></div>
        <p class="timer-label" id="timer-lbl">Appuie sur Écouter pour commencer</p>
        <div class="play-btn-wrap">
          <button class="btn btn-primary" id="btn-play">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="3,1 13,7 3,13"/></svg>
            Écouter
          </button>
          <button class="btn" id="btn-replay" style="display:none" disabled>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1,4 5,4 5,8"/><path d="M5,4 A6,6 0 1,1 2.5,9"/></svg>
            Réécouter
          </button>
        </div>
      </div>

      <div class="answer-zone" id="answer-zone">
        <p class="section-label" style="margin-bottom:8px">Artiste ou titre de la chanson</p>
        <div class="answer-input-wrap">
          <input
            class="answer-input"
            id="answer-input"
            type="text"
            placeholder="Tape ta réponse…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            maxlength="80"
            disabled
          >
          <button class="send-btn" id="btn-send" disabled>↵</button>
        </div>
        <p class="answer-hint" id="answer-hint">Artiste OU titre — les fautes de frappe sont acceptées</p>
        <div id="hint-zone" class="hint-zone" style="display:none">
          <button class="hint-btn" id="btn-hint-artist" disabled>💡 Indice artiste</button>
          <button class="hint-btn" id="btn-hint-title" disabled>💡 Indice titre</button>
          <button class="skip-btn" id="btn-skip" disabled>Passer →</button>
        </div>
        <div id="hint-display"></div>
        <div id="cover-reveal"></div>
      </div>
    </div>
  `;

  updateStreakUI();

  qs('#btn-play').addEventListener('click', startListening);
  qs('#btn-replay').addEventListener('click', startListening);

  const inp = qs('#answer-input');
  qs('#btn-send').addEventListener('click', submitAnswer);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(); });

  qs('#btn-hint-artist').addEventListener('click', () => showHint('artist'));
  qs('#btn-hint-title').addEventListener('click', () => showHint('title'));
  qs('#btn-skip').addEventListener('click', skipRound);
}

function startListening() {
  if (S.answered) return;
  const song = S.songs[S.round];

  qs('#btn-play').style.display = 'none';
  qs('#btn-replay').style.display = 'inline-flex';
  qs('#btn-replay').disabled = true;

  S.canPlay = true;
  S.hasPlayed = true;
  const inp = qs('#answer-input');
  if (inp) { inp.disabled = false; inp.focus(); }
  qs('#btn-send').disabled = false;

  // Show hint + skip buttons after first play
  const hz = qs('#hint-zone');
  if (hz) {
    hz.style.display = 'flex';
    qs('#btn-hint-artist').disabled = false;
    qs('#btn-hint-title').disabled = false;
    qs('#btn-skip').disabled = false;
  }

  playAudio(song, S.duration, () => {
    const rr = qs('#btn-replay');
    if (rr) rr.disabled = false;
  });
}

function showHint(type) {
  const song = S.songs[S.round];
  const target = type === 'artist' ? song.artist : song.title;
  const reveal = Math.ceil(target.length * 0.35); // reveal ~35%
  const hintText = buildHint(target, reveal);
  const label = type === 'artist' ? 'Artiste' : 'Titre';

  const hd = qs('#hint-display');
  if (hd) {
    hd.innerHTML = `<div style="margin-top:8px;font-size:12px;color:var(--text-3)">${label} : <span class="hint-text">${esc(hintText)}</span></div>`;
  }

  // Disable this hint button
  const btn = qs(`#btn-hint-${type}`);
  if (btn) btn.disabled = true;
}

function skipRound() {
  if (S.answered || !S.hasPlayed) return;
  const song = S.songs[S.round];
  S.answered = true;
  S.streak = 0;
  stopAudio();

  const inp = qs('#answer-input');
  if (inp) { inp.disabled = true; inp.classList.add('ko'); inp.value = '— Passé —'; }
  const sb = qs('#btn-send');
  if (sb) sb.disabled = true;
  const rr = qs('#btn-replay');
  if (rr) rr.disabled = true;
  const hz = qs('#hint-zone');
  if (hz) hz.style.display = 'none';

  const hint = qs('#answer-hint');
  if (hint) {
    hint.textContent = `✗ La réponse était : ${song.artist} — ${song.title}`;
    hint.className = 'answer-hint revealed-ko';
  }

  if (song.cover) {
    qs('#cover-reveal').innerHTML = `
      <div class="cover-reveal">
        <img class="cover-img" src="${song.cover}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="cover-info">
          <h4>${esc(song.title)}</h4>
          <p>${esc(song.artist)}</p>
        </div>
      </div>
    `;
  }

  S.history.push({ artist: song.artist, title: song.title, cover: song.cover, correct: false, skipped: true });

  setTimeout(() => {
    S.round++;
    S.answered = false;
    S.canPlay = false;
    if (S.round >= S.songs.length) showResult();
    else render();
  }, 2000);
}

function submitAnswer() {
  if (S.answered || !S.canPlay) return;
  const inp = qs('#answer-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;

  const song = S.songs[S.round];
  const correct = isCorrect(val, song);

  S.answered = true;
  stopAudio();
  inp.disabled = true;
  qs('#btn-send').disabled = true;
  const rr = qs('#btn-replay');
  if (rr) rr.disabled = true;
  const hz = qs('#hint-zone');
  if (hz) hz.style.display = 'none';
  qs('#hint-display').innerHTML = '';

  if (correct) {
    S.score++;
    S.streak++;
    if (S.streak > S.maxStreak) S.maxStreak = S.streak;
    inp.classList.add('ok');
    qs('#answer-hint').textContent = '✓ Bonne réponse !';
    qs('#answer-hint').className = 'answer-hint revealed-ok';
  } else {
    S.streak = 0;
    inp.classList.add('ko');
    qs('#answer-hint').textContent = `✗ La réponse était : ${song.artist} — ${song.title}`;
    qs('#answer-hint').className = 'answer-hint revealed-ko';
  }

  // Show album cover
  if (song.cover) {
    qs('#cover-reveal').innerHTML = `
      <div class="cover-reveal">
        <img class="cover-img" src="${song.cover}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="cover-info">
          <h4>${esc(song.title)}</h4>
          <p>${esc(song.artist)}</p>
        </div>
      </div>
    `;
  }

  S.history.push({ artist: song.artist, title: song.title, cover: song.cover, correct });
  document.getElementById('ui-score').textContent = S.score;
  updateStreakUI();

  setTimeout(() => {
    S.round++;
    S.answered = false;
    S.canPlay = false;
    if (S.round >= S.songs.length) showResult();
    else render();
  }, correct ? 1400 : 2200);
}

function updateStreakUI() {
  const el = document.getElementById('ui-streak');
  if (!el) return;
  el.innerHTML = S.streak >= 2 ? `<div class="streak-badge">${S.streak} 🔥</div>` : '';
}

// ─ RESULT ─────────────────────────────────────────────────
function showResult() {
  stopAudio();
  S.screen = 'result';
  render();
}

function renderResult() {
  const pct = Math.round((S.score / ROUND_COUNT) * 100);
  const hasChal = !!S.challenge;
  const chalWon = hasChal && S.score > S.challenge.score;
  const chalDraw = hasChal && S.score === S.challenge.score;

  app.innerHTML = `
    <div class="site-logo"><h1>Blind Test FR</h1></div>
    <div class="result-wrap">
      <div class="result-hero">
        <div class="result-score-big">${S.score}<span class="result-score-denom">/${ROUND_COUNT}</span></div>
        ${hasChal ? `
          <div class="vs-result">
            <div class="vs-result-row">
              <div class="vs-player">
                <div class="vs-player-name">${esc(S.nickname || 'Toi')}</div>
                <div class="vs-player-score ${chalWon || chalDraw ? 'winner' : 'loser'}">${S.score}</div>
              </div>
              <div class="vs-vs">VS</div>
              <div class="vs-player">
                <div class="vs-player-name">${esc(S.challenge.name)}</div>
                <div class="vs-player-score ${!chalWon ? 'winner' : 'loser'}">${S.challenge.score}</div>
              </div>
            </div>
            <p style="font-size:13px;color:var(--text-2);margin-top:12px;text-align:center">
              ${chalWon ? `Tu as battu ${esc(S.challenge.name)} ! 🏆` : chalDraw ? `Égalité parfaite ! 🤝` : `${esc(S.challenge.name)} a gagné cette fois…`}
            </p>
          </div>
        ` : `<p class="result-msg">${getMsg(S.score)}</p>`}
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-num">${S.maxStreak}</div>
          <div class="stat-lbl">Série max</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${pct}%</div>
          <div class="stat-lbl">Réussite</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${S.duration}s</div>
          <div class="stat-lbl">Mode</div>
        </div>
      </div>

      <div class="section-label">Tes réponses</div>
      <div class="history-list">
        ${S.history.map(h => `
          <div class="history-item">
            ${h.cover ? `<img class="history-cover" src="${h.cover}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="history-cover"></div>'}
            <div class="history-info">
              <b>${esc(h.title)}</b>
              <small>${esc(h.artist)}${h.skipped ? ' — passé' : ''}</small>
            </div>
            <div class="history-badge ${h.correct ? 'ok' : 'ko'}">${h.correct ? '✓' : '✗'}</div>
          </div>
        `).join('')}
      </div>

      <div class="action-row">
        <button class="btn btn-primary" id="btn-challenge">⚔️ Défier un ami</button>
        <button class="btn" id="btn-share">📋 Partager le score</button>
        <button class="btn btn-ghost" id="btn-replay-all">🔄 Rejouer</button>
        <button class="btn btn-ghost" id="btn-menu">Menu</button>
      </div>
    </div>
  `;

  qs('#btn-challenge').addEventListener('click', createChallenge);
  qs('#btn-share').addEventListener('click', shareScore);
  qs('#btn-replay-all').addEventListener('click', () => {
    // Same seed, replay
    S.seed = Math.random().toString(36).slice(2, 10);
    goGame();
  });
  qs('#btn-menu').addEventListener('click', () => {
    clearParams();
    S.challenge = null;
    S.screen = 'home';
    render();
  });
}

function getMsg(score) {
  if (score === 0) return 'Aïe… Tu connais même pas Jul ?';
  if (score <= 2) return 'On remet les AirPods et on réessaie ?';
  if (score <= 4) return 'Tu connais quelques classiques, mais il y a du boulot.';
  if (score <= 6) return 'Pas mal ! Tu t\'y connais bien.';
  if (score <= 8) return 'Sérieux tu gères. Envoie ça à tes potes.';
  if (score === 9) return 'Presque parfait. Quelle oreille !';
  return `Score parfait. T'as pas ta place en soirée, t'es DJ.`;
}

function createChallenge() {
  const url = buildChallengeUrl();
  copyToClipboard(url);
  toast('Lien copié ! Envoie-le à tes potes 🎯');
}

function buildChallengeUrl() {
  const params = {
    seed: S.seed,
    c: S.nickname || 'Anonyme',
    s: S.score,
    d: S.duration,
  };
  if (S.pack) params.p = S.pack;
  const p = new URLSearchParams(params);
  return `${location.origin}${location.pathname}?${p}`;
}

function shareScore() {
  const icons = ['😬','👀','😮','👏','🔥'];
  const icon = icons[Math.min(Math.floor(S.score / 2), 4)];
  const chalText = S.challenge
    ? (S.score > S.challenge.score
        ? `J'ai battu ${S.challenge.name} : ${S.score} vs ${S.challenge.score} !\n`
        : `${S.challenge.name} m'a battu : ${S.score} vs ${S.challenge.score}...\n`)
    : '';
  const text = `${icon} Blind Test FR — ${S.score}/${ROUND_COUNT} en mode ${S.duration}s\n${chalText}Tu fais combien ? ${buildChallengeUrl()}`;
  copyToClipboard(text);
  toast('Copié ! 📋');
}

// ── UTILS ──────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── BOOT ───────────────────────────────────────────────────
(function boot() {
  const p = getParams();
  if (p.seed && p.challenger && p.cscore != null) {
    S.screen = 'home'; // show home with challenge banner
  }
  render();
})();
