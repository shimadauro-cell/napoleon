// 仮アート（SVG）と、差し替え画像の自動読み込み。
// assets/chars/<id>/avatar|cutin|cutin_ok|cutin_ng を .webp → .png の順で探し、無ければ仮SVG。
'use strict';
(function () {
  const NP = window.NP;
  const CHARS = {
    you: { name: NP.L('ユウ', 'Yu'), bg: ['#ffe169', '#ff9fd6'], hair: '#3a3f8f', eye: '#2bb6ff', mood: 'smile', style: 'spiky' },
    crow: { name: NP.L('クロウ', 'Crow'), bg: ['#7f6bff', '#38c7ff'], hair: '#1c2350', eye: '#b347ff', mood: 'smirk', style: 'crow' },
    mira: { name: NP.L('ミラ', 'Mira'), bg: ['#ff8fc8', '#ffd36b'], hair: '#ff5fa8', eye: '#2bd0c9', mood: 'wink', style: 'long' },
    ren: { name: NP.L('レン', 'Ren'), bg: ['#7fe0b0', '#2f9e8f'], hair: '#2d4a3a', eye: '#3a7a5a', mood: 'calm', style: 'neat' },
    luna: { name: NP.L('ルナ', 'Luna'), bg: ['#ffb36b', '#ff5f6d'], hair: '#f4f1ff', eye: '#ff3f6a', mood: 'grin', style: 'bob' },
    mascot: { name: NP.L('ナポ', 'Napo'), bg: ['#fff6b0', '#ffd23f'] },
  };
  const KINDS = ['avatar', 'cutin', 'cutin_ok', 'cutin_ng'];
  const found = {};
  let artTimer = null; // 画像が読み込めたら画面を描き直す合図
  for (const id of Object.keys(CHARS)) for (const kind of KINDS) {
    if (id === 'mascot' && kind !== 'avatar') continue;
    const img = new Image();
    img.onload = () => { found[`${id}/${kind}`] = img.src; clearTimeout(artTimer); artTimer = setTimeout(() => window.dispatchEvent(new Event('np:art')), 60); };
    img.onerror = () => { if (img.src.endsWith('.webp')) img.src = `assets/chars/${id}/${kind}.png`; };
    img.src = `assets/chars/${id}/${kind}.webp`;
  }
  const url = (id, kind) => found[`${id}/${kind}`] || null;
  const bgCss = (id) => `linear-gradient(160deg, ${CHARS[id].bg[0]}, ${CHARS[id].bg[1]})`;

  function svgFace(id, mood = '') {
    const P = CHARS[id];
    let eyes = `<ellipse cx="44" cy="58" rx="6" ry="8" fill="${P.eye}"/><ellipse cx="76" cy="58" rx="6" ry="8" fill="${P.eye}"/><circle cx="46" cy="55" r="2.4" fill="#fff"/><circle cx="78" cy="55" r="2.4" fill="#fff"/>`;
    if (P.mood === 'wink' && mood !== 'ng') eyes = `<path d="M36 59 q6 -6 12 0" stroke="${P.hair === '#f4f1ff' ? '#555' : P.hair}" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="76" cy="58" rx="6" ry="8" fill="${P.eye}"/><circle cx="78" cy="55" r="2.4" fill="#fff"/>`;
    if (P.mood === 'calm' && mood !== 'ng') eyes = `<path d="M37 58 q7 4 14 0 M69 58 q7 4 14 0" stroke="#2d4a3a" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    let mouth = { smile: '<path d="M50 76 q10 12 20 0 z" fill="#ff5f7e"/>', smirk: '<path d="M50 80 q10 6 20 -4" stroke="#7a2a3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
      wink: '<path d="M50 76 q10 12 20 0 z" fill="#ff5f7e"/>', calm: '<path d="M52 80 q8 4 16 0" stroke="#7a2a3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
      grin: '<path d="M46 74 q14 16 28 0 z" fill="#fff" stroke="#7a2a3a" stroke-width="3"/>' }[P.mood];
    if (mood === 'ng') mouth = '<path d="M50 84 q10 -8 20 0" stroke="#7a2a3a" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M92 40 q4 8 0 12 q-4 -4 0 -12" fill="#7fd8ff"/>';
    if (mood === 'ok') mouth = '<path d="M46 74 q14 18 28 0 z" fill="#ff5f7e" stroke="#7a2a3a" stroke-width="2"/>';
    const hair = {
      spiky: `<path d="M18 56 Q14 14 60 12 Q106 14 102 56 Q92 30 70 30 Q76 40 64 42 Q60 30 44 32 Q28 36 18 56 Z" fill="${P.hair}"/><path d="M22 20 L30 2 L40 18 Z M80 18 L90 2 L98 20 Z" fill="${P.hair}"/>`,
      crow: `<path d="M18 52 Q14 14 60 12 Q106 14 102 52 L94 34 L86 46 L78 28 L66 42 L58 24 L48 42 L38 28 L30 46 L24 34 Z" fill="${P.hair}"/>`,
      long: `<path d="M16 70 Q10 16 60 14 Q110 16 104 70 Q98 40 84 34 Q60 46 36 34 Q22 40 16 70 Z" fill="${P.hair}"/><rect x="52" y="12" width="16" height="10" rx="4" fill="#38e0ff"/>`,
      neat: `<path d="M18 50 Q16 12 60 12 Q104 12 102 50 Q100 30 60 28 Q30 28 26 40 Z" fill="${P.hair}"/><rect x="30" y="50" width="60" height="16" rx="8" fill="none" stroke="#2d4a3a" stroke-width="3"/>`,
      bob: `<path d="M14 74 Q8 14 60 12 Q112 14 106 74 L94 74 Q96 40 80 32 Q60 40 40 32 Q24 40 26 74 Z" fill="${P.hair}" stroke="#d9d4f5" stroke-width="2"/><path d="M86 18 l8 -12 l4 14 z" fill="#ff3f6a"/>`,
    }[P.style];
    return `<ellipse cx="60" cy="64" rx="38" ry="40" fill="#fff1e4"/>${hair}${eyes}${mouth}
      <ellipse cx="36" cy="74" rx="6" ry="3.5" fill="#ff9fb4" opacity=".7"/><ellipse cx="84" cy="74" rx="6" ry="3.5" fill="#ff9fb4" opacity=".7"/>`;
  }

  // ---- 背景（露天風呂）。assets/bg/onsen.webp（または .png）があればそれを使い、無ければ下の仮SVG
  let bgUrl = null;
  {
    const img = new Image();
    img.onload = () => { bgUrl = img.src; document.querySelectorAll('.onsen-bg').forEach((el) => applyBg(el)); };
    img.onerror = () => { if (img.src.endsWith('.webp')) img.src = 'assets/bg/onsen.png'; };
    img.src = 'assets/bg/onsen.webp';
  }
  function applyBg(el) {
    if (bgUrl) { el.innerHTML = '<div class="bg-img"></div>' + STEAM; el.querySelector('.bg-img').style.backgroundImage = `url(${bgUrl})`; }
  }
  const STEAM = '<div class="steam s1"></div><div class="steam s2"></div><div class="steam s3"></div><div class="steam s4"></div><div class="steam s5"></div><div class="steam s6"></div>';
  function lantern(x, y, s = 1) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <line x1="0" y1="-200" x2="0" y2="-62" stroke="#2a1a10" stroke-width="4"/>
      <ellipse cx="0" cy="10" rx="120" ry="120" fill="url(#lglow)"/>
      <rect x="-26" y="-66" width="52" height="14" rx="4" fill="#2a1a10"/>
      <ellipse cx="0" cy="10" rx="54" ry="64" fill="url(#lant)"/>
      ${[-40, -20, 0, 20, 40].map((dy) => `<path d="M${-Math.sqrt(Math.max(0, 1 - (dy / 64) ** 2)) * 54} ${10 + dy} Q0 ${16 + dy} ${Math.sqrt(Math.max(0, 1 - (dy / 64) ** 2)) * 54} ${10 + dy}" stroke="#9e2a22" stroke-width="2.5" fill="none" opacity=".7"/>`).join('')}
      <text x="0" y="28" text-anchor="middle" font-size="46" font-weight="900" fill="#2a1a10" font-family="serif">湯</text>
      <rect x="-26" y="70" width="52" height="14" rx="4" fill="#2a1a10"/>
      <path d="M-8 84 L-10 120 M0 84 L0 124 M8 84 L10 120" stroke="#c9a24a" stroke-width="3"/>
    </g>`;
  }
  function rock(x, y, w, h, c = '#5a5f73') {
    return `<path d="M${x} ${y + h} Q${x - 6} ${y + h * 0.3} ${x + w * 0.3} ${y} Q${x + w * 0.7} ${y - h * 0.15} ${x + w} ${y + h * 0.35} Q${x + w + 8} ${y + h} ${x + w * 0.8} ${y + h} Z" fill="${c}"/>
      <path d="M${x + w * 0.25} ${y + h * 0.18} Q${x + w * 0.5} ${y + h * 0.02} ${x + w * 0.75} ${y + h * 0.25}" stroke="rgba(255,255,255,.25)" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  }
  function onsenSvg() {
    const stars = [[120, 60], [260, 140], [420, 50], [700, 90], [880, 40], [1050, 120], [1230, 60], [1500, 150], [1620, 40], [1880, 220], [60, 260], [980, 200]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 2 : 3.2}" fill="#fff" opacity="${i % 2 ? 0.6 : 0.9}"/>`).join('');
    const ripples = [[220, 960, 140], [520, 1010, 180], [880, 990, 120], [1240, 1030, 200], [1600, 970, 150], [1820, 1040, 90], [380, 1060, 110]]
      .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.12}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4"/>`).join('');
    const svg = `<svg class="onsen-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a46"/><stop offset=".45" stop-color="#3b2f72"/><stop offset=".8" stop-color="#a45a86"/><stop offset="1" stop-color="#e59a7a"/></linearGradient>
        <radialGradient id="moonglow"><stop offset="0" stop-color="#fff6d0" stop-opacity=".6"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></radialGradient>
        <linearGradient id="bamboo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a6533"/><stop offset=".35" stop-color="#c9ad68"/><stop offset=".7" stop-color="#a68a4a"/><stop offset="1" stop-color="#6b5629"/></linearGradient>
        <pattern id="fence" width="34" height="140" patternUnits="userSpaceOnUse">
          <rect x="2" y="0" width="30" height="140" fill="url(#bamboo)"/>
          <rect x="2" y="66" width="30" height="7" fill="#5c4820"/><rect x="2" y="73" width="30" height="3" fill="#e2c98a" opacity=".6"/>
        </pattern>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd0c8"/><stop offset=".5" stop-color="#2ea2b0"/><stop offset="1" stop-color="#1e6f8a"/></linearGradient>
        <radialGradient id="lant" cx=".4" cy=".35"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#f05a3c"/><stop offset="1" stop-color="#b52e22"/></radialGradient>
        <radialGradient id="lglow"><stop offset="0" stop-color="#ffb35c" stop-opacity=".55"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4026"/><stop offset="1" stop-color="#3e2414"/></linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#sky)"/>
      ${stars}
      <circle cx="1690" cy="120" r="170" fill="url(#moonglow)"/><circle cx="1690" cy="120" r="58" fill="#fff6d8"/>
      <path d="M0 470 L160 380 L300 430 L470 330 L640 420 L820 360 L1000 440 L1180 350 L1360 420 L1540 340 L1720 410 L1920 360 L1920 560 L0 560 Z" fill="#2b2556" opacity=".9"/>
      <path d="M0 510 L200 450 L380 500 L600 440 L820 500 L1060 450 L1300 505 L1520 455 L1760 500 L1920 470 L1920 580 L0 580 Z" fill="#221d45"/>
      <rect x="0" y="420" width="1920" height="440" fill="url(#fence)"/>
      <rect x="0" y="420" width="1920" height="440" fill="rgba(20,10,30,.18)"/>
      <rect x="0" y="470" width="1920" height="16" fill="#4a2f17"/><rect x="0" y="760" width="1920" height="16" fill="#4a2f17"/>
      ${[100, 420, 740, 1060, 1380, 1700].map((x) => `<path d="M${x} 466 l14 24 l14 -24 M${x} 756 l14 24 l14 -24" stroke="#1d120a" stroke-width="4" fill="none"/>`).join('')}
      <rect x="0" y="0" width="1920" height="34" fill="url(#beam)"/>
      <rect x="0" y="0" width="60" height="880" fill="url(#beam)"/><rect x="1860" y="0" width="60" height="880" fill="url(#beam)"/>
      <rect x="0" y="840" width="1920" height="240" fill="url(#water)"/>
      ${ripples}
      <path d="M0 850 Q480 820 960 848 Q1440 876 1920 846 L1920 866 Q1440 896 960 868 Q480 840 0 870 Z" fill="rgba(255,255,255,.35)"/>
      ${rock(-30, 770, 230, 110, '#4c5165')}${rock(150, 800, 170, 80, '#62677c')}${rock(1660, 780, 220, 100, '#4c5165')}${rock(1560, 812, 150, 70, '#62677c')}${rock(1820, 800, 160, 90, '#575c71')}
      ${lantern(120, 210, 0.95)}${lantern(1800, 230, 0.95)}
    </svg>`;
    // 画面ごとにIDを分ける（非表示の画面のグラデーションを参照すると塗りが消えるため）
    const k = 'o' + (++bgCount) + '-';
    return svg.replace(/id="([a-z]+)"/g, `id="${k}$1"`).replace(/url\(#([a-z]+)\)/g, `url(#${k}$1)`);
  }
  let bgCount = 0;

  NP.Art = {
    CHARS,
    // 背景を el に描く（画像があれば画像）
    background(el) {
      el.classList.add('onsen-bg');
      if (bgUrl) applyBg(el); else el.innerHTML = onsenSvg() + STEAM;
    },
    name: (id) => CHARS[id].name,
    colors: (id) => CHARS[id].bg,
    avatar(id, mood = '') {
      const u = url(id, 'avatar');
      if (u) return `<img class="avatar-img" src="${u}" alt="" style="background:${bgCss(id)}">`;
      if (id === 'mascot') return NP.Art.svgMascot();
      return `<svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true"><defs><linearGradient id="ag-${id}-${mood}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${CHARS[id].bg[0]}"/><stop offset="1" stop-color="${CHARS[id].bg[1]}"/></linearGradient></defs>
        <rect width="120" height="120" rx="28" fill="url(#ag-${id}-${mood})"/>${svgFace(id, mood)}</svg>`;
    },
    // カットイン用の立ち絵。mood: '' / 'ok' / 'ng'。無ければ通常→アバター仮絵の順
    cutin(id, mood = '') {
      const u = (mood && url(id, `cutin_${mood}`)) || url(id, 'cutin');
      return u ? `<img class="cutin-img" src="${u}" alt="">` : `<div class="cutin-fallback">${NP.Art.avatar(id, mood)}</div>`;
    },
    svgMascot() {
      return `<svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
        <rect width="120" height="120" rx="28" fill="#fff6b0"/>
        <path d="M20 46 Q60 -6 100 46 Z" fill="#1d2357"/><path d="M14 46 H106 L100 54 H20 Z" fill="#1d2357"/>
        <circle cx="60" cy="26" r="7" fill="#ffd23f"/><path d="M40 40 h40" stroke="#ff3f6a" stroke-width="5"/>
        <ellipse cx="60" cy="78" rx="36" ry="30" fill="#fff" stroke="#1d2357" stroke-width="4"/>
        <ellipse cx="47" cy="76" rx="5" ry="7" fill="#1d2357"/><ellipse cx="73" cy="76" rx="5" ry="7" fill="#1d2357"/>
        <circle cx="49" cy="73" r="2" fill="#fff"/><circle cx="75" cy="73" r="2" fill="#fff"/>
        <path d="M52 92 Q60 98 68 92" stroke="#1d2357" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse cx="36" cy="88" rx="6" ry="3.5" fill="#ff9fb4"/><ellipse cx="84" cy="88" rx="6" ry="3.5" fill="#ff9fb4"/>
      </svg>`;
    },
  };
})();
