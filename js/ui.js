// 画面・入力・ログ・画面遷移。ルール判定はすべて engine.js、CPU判断は ai.js（観測情報のみ）に任せる。
'use strict';
(function () {
  const NP = window.NP;
  const { Cards } = NP;
  const S = NP.Sound;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sym = (s) => Cards.SUIT_SYM[s];
  const T = NP.L; // 言語（日本語 / 英語）
  const en = NP.lang === 'en';
  const poss = (n) => T(n + 'の', n === 'You' ? 'Your ' : n + "'s "); // 「〇〇の」
  const pc = (n) => (n === 1 ? 'point card' : 'point cards'); // 英語の単数・複数
  const turnOf = (n) => T(`${n}の番です`, n === 'You' ? 'Your turn' : `${n}'s turn`);
  const symHtml = (s) => `<span class="sym ${s === 'H' || s === 'D' ? 'red' : 'black'}">${sym(s)}</span>`;
  const cardName = (c) => (c === 'JK' ? T('ジョーカー', 'Joker') : `${sym(Cards.suit(c))}${Cards.rankLabel(Cards.rank(c))}`);
  const cardNameHtml = (c) => (c === 'JK' ? `<b class="jk-name">${T('ジョーカー', 'Joker')}</b>` : `<b class="cname ${Cards.isRed(c) ? 'red' : 'black'}">${cardName(c)}</b>`);

  // ------------------------------------------------------------------ 保存（バージョン付き。壊れていれば初期値）
  const VER = 'np.v1.';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(VER + k); if (v == null) return d; const o = JSON.parse(v); return o == null ? d : o; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(VER + k, JSON.stringify(v)); } catch (e) { /* noop */ } },
  };
  const DEFAULTS = { speed: 1, reduceMotion: false, hint: true, stopEachTrick: false, level: 'standard', tutorialDone: [], myChar: 'you' };
  const settings = (() => {
    const s = store.get('settings', {});
    const o = { ...DEFAULTS, ...(typeof s === 'object' ? s : {}) };
    if (![1, 2, 3].includes(o.speed)) o.speed = 1;
    if (!Array.isArray(o.tutorialDone)) o.tutorialDone = [];
    return o;
  })();
  const saveSettings = () => store.set('settings', settings);
  const EMPTY_STATS = () => ({ rounds: 0, wins: 0, byRole: { napoleon: [0, 0], adjutant: [0, 0], allied: [0, 0] }, solo: [0, 0], matches: 0, firsts: 0, rankSum: 0 });
  const loadStats = () => { const s = store.get('stats', null); return s && s.byRole ? { ...EMPTY_STATS(), ...s } : EMPTY_STATS(); };

  const CHARS = ['you', 'crow', 'mira', 'ren', 'luna'];
  const ROLE_LABEL = { napoleon: T('♛ ナポレオン', '♛ Napoleon'), adjutant: T('★ 副官', '★ Adjutant'), allied: T('⚑ 連合軍', '⚑ Allies') };
  // 場の札の位置（ステージ座標の中心）と席パネルの中心
  const SLOT = [{ x: 960, y: 590 }, { x: 750, y: 495 }, { x: 840, y: 330 }, { x: 1080, y: 330 }, { x: 1170, y: 495 }];
  const SEAT_C = [{ x: 129, y: 723 }, { x: 129, y: 439 }, { x: 375, y: 205 }, { x: 1365, y: 205 }, { x: 1611, y: 417 }]; // 顔アイコンの中心
  const LINES = {
    napoleon: en ? { you: "Alright, let's go!", crow: 'Leave it to me.', mira: "Napoleon's mine~♪", ren: "I'll play it safe.", luna: 'Going big!' }
      : { you: 'よし、やるぞ！', crow: '任せな。', mira: 'ナポレオン、いただき♪', ren: '堅実にいきます。', luna: 'ド派手にいくよ！' },
    take: en ? { you: 'Got it!', crow: 'Mine.', mira: 'Yay♪', ren: 'As calculated.', luna: 'Gimme!' }
      : { you: '取った！', crow: 'もらった。', mira: 'やった♪', ren: '計算通りです。', luna: 'いっただきー！' },
    reveal: en ? { you: "I'm the adjutant!", crow: "...I'm the adjutant.", mira: "Ta-da, I'm the adjutant!", ren: 'I am the adjutant.', luna: 'Adjutant Luna, here!' }
      : { you: '副官は私！', crow: '…副官は俺だ。', mira: 'じゃーん、副官は私！', ren: '副官は私です。', luna: '副官、ルナ参上！' },
    win: en ? { you: 'We did it!', crow: 'Naturally.', mira: 'Thanks, everyone♪', ren: 'A good result.', luna: 'The best!' }
      : { you: 'やった！', crow: '当然だ。', mira: 'みんなありがと♪', ren: 'よい結果です。', luna: 'サイコー！' },
    lose: en ? { you: 'So close...', crow: 'Tch...', mira: 'Waaah...', ren: 'I misread it...', luna: 'Not over yet!' }
      : { you: 'くやしい…', crow: 'ちっ…', mira: 'えーん…', ren: '読み違えました…', luna: 'まだまだー！' },
    solo: en ? { you: 'Going solo!', crow: 'One vs four? Fine.', mira: 'I can do it alone!', ren: 'A solo game.', luna: 'Bring it on, all of you!' }
      : { you: 'ひとりで勝負！', crow: '1対4、上等だ。', mira: 'ひとりでもいけるもん！', ren: '単独戦です。', luna: '全員かかってこい！' },
  };

  // ------------------------------------------------------------------ 画面サイズ
  function fit() {
    const w = window.innerWidth, h = window.innerHeight;
    const stage = $('#stage');
    const sc = Math.min(w / 1920, h / 1080);
    stage.style.transform = `translate(${(w - 1920 * sc) / 2}px, ${(h - 1080 * sc) / 2}px) scale(${sc})`;
    const root = document.documentElement;
    root.classList.toggle('compact', sc < 0.6); // 小さい横画面：飾りを減らして手札・操作を大きく
    const portrait = h > w && w < 900;
    $('#rotate-note').classList.toggle('hidden', !portrait);
  }
  function applyVisualSettings() {
    document.documentElement.style.setProperty('--speed', settings.speed);
    document.documentElement.classList.toggle('reduce-motion', !!settings.reduceMotion);
  }

  // ------------------------------------------------------------------ カード
  function cardHtml(c, o = {}) {
    if (o.back) return `<div class="card back ${o.cls || ''}" aria-label="${T('裏向きの札', 'face-down card')}"></div>`;
    const role = o.trump !== undefined ? Cards.roleName(c, o.trump, o.cfg) : '';
    const tag = role && o.tag !== false ? `<span class="c-tag">${role}</span>` : '';
    const attrs = `data-card="${c}" ${o.idx != null ? `data-idx="${o.idx}"` : ''} role="button" aria-label="${cardName(c)}${role ? ' ' + role : ''}${Cards.isPoint(c) ? T(' 得点札', ' point card') : ''}"`;
    const cls = `card ${o.cls || ''}${o.dim ? ' dim' : ''}${o.sel ? ' sel' : ''}`;
    if (c === 'JK') return `<div class="${cls} joker" ${attrs}><span class="c-corner">JK</span><span class="c-center">★</span><span class="c-word">JOKER</span>${tag}</div>`;
    const s = Cards.suit(c), r = Cards.rankLabel(Cards.rank(c));
    return `<div class="${cls} ${Cards.isRed(c) ? 'red' : 'black'}${Cards.isPoint(c) ? ' point' : ''}" ${attrs}>
      <span class="c-corner">${r}<br>${sym(s)}</span><span class="c-center">${sym(s)}</span><span class="c-rank">${r}</span>${Cards.isPoint(c) ? `<span class="c-point" title="${T('得点札', 'Point card')}">${T('得', 'P')}</span>` : ''}${tag}</div>`;
  }

  // ------------------------------------------------------------------ セッション
  let sess = null;
  let sessNo = 0;
  const later = (fn, ms) => {
    if (!sess) return;
    const id = sess.id;
    const t = setTimeout(() => { if (!sess || sess.id !== id) return; sess.timers.delete(t); fn(); }, ms / settings.speed);
    sess.timers.add(t);
    return t;
  };

  function startSession(opts) {
    endSession(true);
    const human = opts.human === undefined ? 0 : opts.human;
    const st = opts.st || NP.createGame(opts.cfg, opts.seed);
    sess = {
      id: ++sessNo, mode: opts.mode, st, human, level: opts.level || settings.level,
      chars: opts.chars || CHARS.slice(),
      names: (opts.chars || CHARS).map((id, i) => (i === 0 && human !== null ? T('あなた', 'You') : NP.Art.name(id))),
      timers: new Set(), sel: [], bidSuit: null, bidCount: null, callSel: null, jokerPick: false,
      log: [], revealAll: false, hooks: opts.hooks || {}, onExit: opts.onExit || null, seenSpecial: {},
      bubbles: {}, recordStats: !!opts.recordStats, hintOn: opts.hint != null ? opts.hint : settings.hint, focus: 0,
      lastHint: null, resultShown: false,
    };
    $('#title').classList.add('hidden');
    $('#game').classList.remove('hidden');
    $('#modal-layer').innerHTML = '';
    $('#goal').classList.remove('warn');
    $('#log-panel').classList.add('hidden');
    $('#spectate-bar').classList.toggle('hidden', human !== null);
    NP.Fx.clear();
    S.setIntensity(0);
    addLog(`— ${st.cfg.rounds === 5 ? T('5局マッチ', '5-Round Match') : T('1局勝負', 'Single Round')} —`);
    onNewDeal();
    render();
    step();
    return sess;
  }
  function endSession(silent) {
    if (!sess) return;
    for (const t of sess.timers) clearTimeout(t);
    const s = sess;
    sess = null;
    NP.Fx.clear();
    $('#coach').classList.add('hidden');
    if (!silent && s.onExit) s.onExit();
  }

  function addLog(text, cls = '') {
    if (!sess) return;
    sess.log.push({ text, cls });
    if (sess.log.length > 400) sess.log.shift();
    const body = $('#log-panel .log-body');
    if (body && !$('#log-panel').classList.contains('hidden')) renderLog();
  }
  function renderLog() {
    const body = $('#log-panel .log-body');
    body.innerHTML = sess.log.map((l) => `<div class="log-line ${l.cls}">${l.text}</div>`).join('');
    body.scrollTop = body.scrollHeight;
  }

  function toast(text, ms = 2600) {
    const t = $('#toast');
    t.innerHTML = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function say(seat, text, ms = 1800) {
    if (!sess) return;
    sess.bubbles[seat] = { text, until: Date.now() + ms / settings.speed };
    renderSeats();
    later(() => renderSeats(), ms + 50);
  }

  // ------------------------------------------------------------------ 進行
  function act(a) {
    if (!sess) return false;
    const st = sess.st;
    const deny = a.seat === sess.human && sess.hooks.allowAction && sess.hooks.allowAction(a); // 制限は人間の操作だけ
    if (deny) { toast(esc(deny)); S.play('error'); return false; }
    // 交換札（NEW表示用）。本人がナポレオンのときだけ覚える
    if (a.type === 'call' && sess.human != null && sess.human === st.napoleon) sess.kittyCards = st.kitty.slice();
    const r = NP.applyAction(st, a);
    if (!r.ok) { toast(esc(r.error)); S.play('error'); return false; }
    for (const ev of r.events) onEvent(ev, a);
    if (sess.hooks.afterAction) sess.hooks.afterAction(a, r.events);
    if (!sess) return true;
    sess.sel = []; sess.jokerPick = false; sess.lastHint = null;
    render();
    step();
    return true;
  }

  function actorOf(st) {
    if (st.phase === 'BIDDING' || st.phase === 'PLAY') return st.turn;
    if (st.phase === 'CALL_ADJUTANT' || st.phase === 'EXCHANGE') return st.napoleon;
    return null;
  }

  function step() {
    if (!sess) return;
    const st = sess.st;
    if (sess.hooks.gate && sess.hooks.gate(st)) return;
    const who = actorOf(st);
    if (who != null) {
      if (who === sess.human) { renderHint(); announceTurn(st); return; }
      const aid = st.actionId;
      const wait = st.phase === 'BIDDING' ? 700 : st.phase === 'PLAY' ? (st.trick.length ? 750 : 900) : 1100;
      later(() => { if (sess && sess.st.actionId === aid) cpuMove(who); }, withHold(wait, 250));
      return;
    }
    switch (st.phase) {
      case 'TRICK_RESULT': return trickResult();
      case 'REDEAL_WAIT': return redealPrompt();
      case 'ROUND_RESULT': { const aid = st.actionId; later(() => { if (sess && sess.st.actionId === aid) showRoundResult(); }, 1500); return; }
      case 'MATCH_RESULT': return showMatchResult();
    }
  }

  // 自分の番になった瞬間に「YOUR TURN」を大きく出す（カットイン中なら終わってから）
  const TURN_SUB = { BIDDING: T('宣言するか、パスを選んでください', 'Bid or pass'), CALL_ADJUTANT: T('副官にする札を指定してください', 'Call a card for your adjutant'), EXCHANGE: T('捨てる3枚を選んでください', 'Choose 3 cards to discard') };
  function announceTurn(st) {
    const key = st.phase + '|' + st.actionId;
    if (sess.lastTurnKey === key) return;
    sess.lastTurnKey = key;
    const sub = st.phase === 'PLAY' ? (st.trick.length ? T('札を1枚出してください', 'Play a card') : T('先手です。好きな札を出せます', 'You lead — play any card')) : TURN_SUB[st.phase] || '';
    const id = sess.id;
    const show = () => {
      if (!sess || sess.id !== id || sess.lastTurnKey !== key || sess.st.actionId + '' !== key.split('|')[1]) return;
      NP.Fx.yourTurn(sub);
      S.play('yourturn');
    };
    const wait = Math.max(0, (sess.holdUntil || 0) - Date.now());
    if (wait > 30) setTimeout(show, wait + 100); else show();
  }
  function cpuMove(seat) {
    const st = sess.st;
    let a = sess.hooks.cpuAction ? sess.hooks.cpuAction(seat, st) : null;
    if (!a) a = NP.AI.decide(NP.getObservation(st, seat), { level: sess.level, charId: sess.chars[seat], seed: st.seed + '|ai' });
    act(a);
  }

  // ------------------------------------------------------------------ カットインの待ち時間（演出中はCPUが次の札を出さない）
  function hold(ms, real = false) {
    if (!sess) return;
    const until = Date.now() + (real ? ms : ms / settings.speed);
    sess.holdUntil = Math.max(sess.holdUntil || 0, until);
  }
  // 通常の待ち時間 base（×1基準）と、演出の残り＋余韻 after を比べて長いほう（later() は速度で割るので ×speed で渡す）
  function withHold(base, after) {
    const remain = Math.max(0, (sess.holdUntil || 0) - Date.now());
    const real = Math.max(base / settings.speed, remain ? remain + after / settings.speed : 0);
    return real * settings.speed;
  }
  // 役札を出したときのカットイン
  function playCutin(c, ev, st) {
    const t = st.trump;
    if (c === 'S14') return { text: T('マイティ！', 'Mighty!'), sub: T('いちばん強い札', 'The strongest card'), color: '#ffb21f', color2: '#ff3f6a' };
    if (c === 'JK') return { text: T('ジョーカー！', 'Joker!'), sub: ev.requestedSuit ? T(`${sym(ev.requestedSuit)}を要求`, `Calls ${sym(ev.requestedSuit)}`) : T('マイティの次に強い', 'Second only to the Mighty'), color: '#8a4dff', color2: '#22c7ff' };
    if (c === t + '11') return { text: T('正ジャック！', 'Right Jack!'), sub: T(`切札${sym(t)}のJ`, `Jack of trump ${sym(t)}`), color: '#2fe39a', color2: '#1d7a8f' };
    if (c === Cards.LEFT_SUIT[t] + '11') return { text: T('裏ジャック！', 'Left Jack!'), sub: T(`切札${sym(t)}と同じ色のJ`, `Same-color Jack as trump ${sym(t)}`), color: '#22c7ff', color2: '#2b3480' };
    if (c === 'H12' && st.cfg.yoromeki && st.trick.some((x) => x.card === 'S14')) return { text: T('よろめき！', 'Swoon!'), sub: T('マイティを討つ♥Q', 'The ♥Q that topples the Mighty'), color: '#ff5fa8', color2: '#ff3f6a' };
    if (c === 'C3' && st.trick.length === 1 && NP.isJokerRequest(st.trick, st.cfg)) return { text: T('ジョーカー請求！', 'Joker Call!'), sub: T('ジョーカーを持つ人は必ず出す', 'Whoever holds the Joker must play it'), color: '#22c7ff', color2: '#8a4dff' };
    return null;
  }
  // 役で巡に勝ったときのカットイン
  const WIN_CUTIN = {
    YOROMEKI: { text: T('よろめき勝ち！', 'Swoon Win!'), color: '#ff5fa8', color2: '#ffd23f' },
    MIGHTY: { text: T('マイティ制圧！', 'Mighty Rules!'), color: '#ffb21f', color2: '#ff3f6a' },
    JOKER: { text: T('ジョーカー勝利！', 'Joker Wins!'), color: '#8a4dff', color2: '#ffd23f' },
    RIGHT_JACK: { text: T('正ジャック勝利！', 'Right Jack Wins!'), color: '#2fe39a', color2: '#ffd23f' },
    LEFT_JACK: { text: T('裏ジャック勝利！', 'Left Jack Wins!'), color: '#22c7ff', color2: '#ffd23f' },
    SAME_TWO: { text: T('セイム2逆転！', 'Same Two Upset!'), color: '#2fe39a', color2: '#ff3fa4' },
  };
  // ------------------------------------------------------------------ イベント（音・演出・ログ・台詞）
  function onEvent(ev) {
    const st = sess.st, N = sess.names;
    const human = sess.human;
    switch (ev.t) {
      case 'bid': S.play('bid'); addLog(T(`${N[ev.seat]}：${sym(ev.suit)}${ev.count}枚を宣言`, `${N[ev.seat]}: bids ${sym(ev.suit)}${ev.count}`)); say(ev.seat, `${sym(ev.suit)}${ev.count}`, 2200); break;
      case 'pass': S.play('pass'); addLog(T(`${N[ev.seat]}：パス`, `${N[ev.seat]}: pass`), 'dim'); say(ev.seat, T('パス', 'Pass'), 1500); break;
      case 'allPass': addLog(T('全員パス → 配り直し', 'Everyone passed → redeal'), 'em'); break;
      case 'redeal': onNewDeal(); break;
      case 'newRound': onNewDeal(); break;
      case 'napoleon':
        S.play('stamp');
        addLog(T(`<b>ナポレオン：${N[ev.seat]}</b>（切札${sym(ev.suit)}・目標${ev.count}枚）`, `<b>Napoleon: ${N[ev.seat]}</b> (trump ${sym(ev.suit)}, target ${ev.count})`), 'em');
        NP.Fx.bigText(T(`ナポレオン：${N[ev.seat]}`, `Napoleon: ${N[ev.seat]}`), { sub: T(`切札 ${sym(ev.suit)}${Cards.SUIT_NAME[ev.suit]}　目標 ${ev.count}枚`, `Trump ${sym(ev.suit)} ${Cards.SUIT_NAME[ev.suit]} · Target ${ev.count}`), color: '#ffd23f', ms: 1600 });
        later(() => say(ev.seat, LINES.napoleon[sess.chars[ev.seat]]), 400);
        break;
      case 'call': {
        const nm = Cards.roleName(ev.card, st.trump, st.cfg);
        addLog(T(`副官の指定札：${cardNameHtml(ev.card)}${nm ? `（${nm}）` : ''}`, `Adjutant card: ${cardNameHtml(ev.card)}${nm ? ` (${nm})` : ''}`), 'em');
        S.play('stamp');
        if (human != null && st.adjutant === human) {
          later(() => { NP.Fx.bigText(T('あなたは副官！', "You're the Adjutant!"), { sub: T(`${cardName(ev.card)}を持っています。正体は札を出すまで秘密`, `You hold ${cardName(ev.card)}. Keep it secret until you play it`), color: '#ff8fd0', ms: 2400 }); S.play('reveal'); }, 300);
          addLog(T(`（あなただけに）あなたは副官です。${cardNameHtml(ev.card)}を出すまで正体は秘密です。`, `(Only you) You are the adjutant. Stay hidden until you play ${cardNameHtml(ev.card)}.`), 'secret');
        } else if (human != null && st.napoleon !== human) {
          addLog(T('（あなただけに）あなたは連合軍です。副官が誰かはまだ分かりません。', '(Private) You are on the allied team. You do not yet know who the adjutant is.'), 'secret');
        }
        break;
      }
      case 'takeKitty':
        if (human != null && st.napoleon === human && st.soloReason === 'kitty') {
          later(() => toast(T('指定札は交換札にありました。<b>1対4の単独戦</b>です（あなただけが知っています）', 'The called card was in the kitty. <b>You play solo, 1 vs 4</b> (only you know)'), 4200), 200);
          addLog(T('（あなただけに）指定札は交換札にありました。単独戦です。', '(Only you) The called card was in the kitty. Solo game.'), 'secret');
        }
        break;
      case 'exchange':
        S.play('deal');
        addLog(T(`${N[st.napoleon]}が交換札を取り、3枚捨てました${ev.publicDiscards.length ? `（表向き：${ev.publicDiscards.map(cardNameHtml).join('・')}）` : '（すべて裏向き）'}`, `${N[st.napoleon]} took the kitty and discarded 3${ev.publicDiscards.length ? ` (face up: ${ev.publicDiscards.map(cardNameHtml).join(', ')})` : ' (all face down)'}`));
        if (ev.publicDiscards.length) addLog(T(`捨てた得点札${ev.publicDiscards.length}枚は、最初の巡の勝者が取ります`, (ev.publicDiscards.length === 1 ? "The discarded point card goes to the first trick's winner" : `The ${ev.publicDiscards.length} discarded point cards go to the first trick's winner`)), 'dim');
        break;
      case 'soloRevealed':
        S.play('reveal');
        NP.Fx.bigText(T('単独戦！', 'Solo Game!'), { sub: ev.by === 'discard' ? T('ナポレオンが指定札を捨てました。1対4です', 'Napoleon discarded the called card. 1 vs 4') : T('ナポレオン本人が指定札を出しました。1対4です', 'Napoleon played the called card. 1 vs 4'), color: '#ff9a2e', ms: 1800 });
        addLog(T('<b>単独戦が判明</b>（ナポレオン1人 対 4人）', '<b>Solo game revealed</b> (Napoleon alone vs 4)'), 'em');
        later(() => say(st.napoleon, LINES.solo[sess.chars[st.napoleon]]), 500);
        break;
      case 'adjutantRevealed':
        S.play('reveal');
        NP.Fx.cutin(sess.chars[ev.seat], T('副官判明！', 'Adjutant Revealed!'), { name: N[ev.seat], sub: T(`指定札 ${cardName(st.calledCard)}${Cards.roleName(st.calledCard, st.trump, st.cfg) ? '（' + Cards.roleName(st.calledCard, st.trump, st.cfg) + '）' : ''}`, `Called card ${cardName(st.calledCard)}${Cards.roleName(st.calledCard, st.trump, st.cfg) ? ' (' + Cards.roleName(st.calledCard, st.trump, st.cfg) + ')' : ''}`), card: cardHtml(st.calledCard, { trump: st.trump, cfg: st.cfg }), color: '#ff3fa4', color2: '#8a4dff', ms: 2600 });
        hold(2600);
        addLog(T(`<b>副官判明：${N[ev.seat]}</b>（${cardNameHtml(st.calledCard)}を出しました）`, `<b>Adjutant revealed: ${N[ev.seat]}</b> (played ${cardNameHtml(st.calledCard)})`), 'em');
        later(() => say(ev.seat, LINES.reveal[sess.chars[ev.seat]]), 300);
        break;
      case 'jokerRequest':
        addLog(T(`${N[ev.seat]}が♣3で先手 → ジョーカー請求`, `${N[ev.seat]} led ♣3 → Joker Call`), 'em');
        break;
      case 'play': {
        S.play('card');
        const c = ev.card;
        let txt = `${N[ev.seat]}${T('：', ': ')}${cardNameHtml(c)}`;
        if (ev.requestedSuit) txt += T(`（${sym(ev.requestedSuit)}を指定）`, ` (calls ${sym(ev.requestedSuit)})`);
        addLog(txt, 'play');
        // 役札を出したら、出した人のカットイン（副官判明と同時なら副官判明のカットインにまとめる）
        const revealNow = c === st.calledCard && st.adjutantRevealed && st.adjutant === ev.seat && st.revealTrick === st.trickNo;
        const rc = playCutin(c, ev, st);
        if (rc && !revealNow) {
          NP.Fx.cutin(sess.chars[ev.seat], rc.text, { name: N[ev.seat], sub: rc.sub, card: cardHtml(c, { trump: st.trump, cfg: st.cfg }), color: rc.color, color2: rc.color2, ms: 2300 });
          S.play('cutin');
          hold(2300);
        }
        if (c === 'JK' && ev.requestedSuit) toast(T(`ジョーカーの要求マーク：<b>${sym(ev.requestedSuit)}</b>`, `Joker calls: <b>${sym(ev.requestedSuit)}</b>`));
        break;
      }
      case 'trickEnd': break;
      case 'collect': {
        const total = ev.playedPointCount + ev.discardPointCount;
        S.play('collect');
        addLog(T(`→ ${N[ev.seat]}が回収（得点札${ev.playedPointCount}枚${ev.discardPointCount ? `＋捨て札の得点札${ev.discardPointCount}枚` : ''}）`, `→ ${N[ev.seat]} takes it (${ev.playedPointCount} ${pc(ev.playedPointCount)}${ev.discardPointCount ? ` + ${ev.discardPointCount} from the discards` : ''})`), 'win');
        if (total >= 3) say(ev.seat, LINES.take[sess.chars[ev.seat]]);
        if (st.trickNo >= 7) S.setIntensity(1);
        break;
      }
      case 'roundEnd': onRoundEnd(ev.result); break;
    }
    if (ev.t === 'collect' || ev.t === 'adjutantRevealed' || ev.t === 'soloRevealed') checkGoal();
  }

  // ナポレオン軍が目標枚数に届いたら、ナビ（ナポ）のカットインで知らせる。
  // 公開情報だけで判定する（副官が未判明の間はナポレオン本人の枚数だけ）。副官の正体を漏らさないため
  function checkGoal() {
    const st = sess.st;
    if (sess.goalAnnounced || st.napoleon == null || st.phase === 'ROUND_RESULT' || st.phase === 'MATCH_RESULT') return;
    const team = [st.napoleon];
    if (st.adjutantRevealed && st.adjutant != null) team.push(st.adjutant);
    const n = team.reduce((a, s) => a + st.wonCards[s].length, 0);
    if (n < st.target) return;
    sess.goalAnnounced = true;
    const solo = st.soloRevealed;
    const who = solo ? T('ナポレオン（単独）', 'Napoleon (solo)') : team.length > 1 ? T('ナポレオン軍', "Napoleon's army") : T('ナポレオン', 'Napoleon');
    addLog(T(`<b>${who}が目標${st.target}枚に到達！</b>（${n}枚）勝利確定`, `<b>${who} reached the target of ${st.target}!</b> (${n}) Victory locked in`), 'em');
    const show = () => {
      if (!sess || sess.st !== st) return;
      // 自分の陣営（本人だけが知っている）で勝利／敗北の演出を分ける。観戦では勝利版
      const h = sess.human;
      const lose = h != null && h !== st.napoleon && h !== st.adjutant;
      if (lose) {
        NP.Fx.cutin('mascot', T('ナポレオン勝利確定！', "Napoleon's Army Wins!"), { name: NP.Art.name('mascot'), sub: T(`連合軍の負けが決まりました… （${n}枚／目標${st.target}枚）`, `The Allies have lost... (${n} / target ${st.target})`), mood: 'ng', color: '#7f93c9', color2: '#2b3480', ms: 2900, lose: true });
        S.play('cutinLose');
      } else {
        NP.Fx.cutin('mascot', T('ナポレオン勝利確定！', "Napoleon's Army Wins!"), { name: NP.Art.name('mascot'), sub: T(`${who} ${n}枚／目標${st.target}枚 到達`, `${who}: ${n} / target ${st.target} reached`), color: '#ffd23f', color2: '#ff9a2e', ms: 2900, win: true });
        S.play('cutinWin');
      }
    };
    const wait = Math.max(0, (sess.holdUntil || 0) - Date.now());
    if (wait > 30) setTimeout(show, wait); else show();
    hold(wait + 2900 / settings.speed, true);
  }

  function onNewDeal() {
    const st = sess.st;
    sess.seenSpecial = {}; sess.bubbles = {}; sess.resultShown = false; sess.goalAnnounced = false;
    sess.bidSuit = null; sess.bidCount = null; sess.callSel = null; sess.sel = [];
    S.setIntensity(0);
    if (st.phase === 'BIDDING') addLog(T(`第${st.roundNo + 1}局の配札（親：${sess.names[st.dealer]}）。競りは${sess.names[st.turn]}から`, `Round ${st.roundNo + 1} dealt (dealer: ${sess.names[st.dealer]}). Bidding starts with ${sess.names[st.turn]}`), 'head');
    S.play('deal');
  }

  function onRoundEnd(r) {
    const N = sess.names;
    S.setIntensity(0);
    const team = [r.napoleon].concat(r.adjutant != null ? [r.adjutant] : []);
    const text = r.success ? T('ナポレオン軍 勝利！', "Napoleon's Army Wins!") : T('連合軍 勝利！', 'Allies Win!');
    addLog(T(`<b>${text}</b> ナポレオン軍 ${r.napCount}枚 / 目標${r.target}枚`, `<b>${text}</b> Napoleon's army ${r.napCount} / target ${r.target}`), 'em');
    if (r.adjutant != null && !sess.st.tricks.some((t) => t.cards.some((x) => x.card === r.calledCard && x.seat === r.adjutant))) addLog(T(`副官は${N[r.adjutant]}でした`, `The adjutant was ${N[r.adjutant]}`), 'em');
    const humanWon = sess.human != null && (team.includes(sess.human) === r.success);
    S.play(sess.human == null ? (r.success ? 'win' : 'lose') : humanWon ? 'win' : 'lose');
    NP.Fx.bigText(text, { sub: T(`${r.napCount}枚 / 目標${r.target}枚`, `${r.napCount} / target ${r.target}`), color: r.success ? '#ffd23f' : '#22c7ff', ms: 1800 });
    if (r.success || humanWon) NP.Fx.confetti(960, 420, 70);
    for (let s = 0; s < 5; s++) later(() => say(s, (team.includes(s) === r.success ? LINES.win : LINES.lose)[sess.chars[s]], 2200), 300 + s * 120);
    if (sess.recordStats && sess.human != null) recordStats(r);
  }

  function recordStats(r) {
    const s = loadStats();
    const h = sess.human;
    const role = h === r.napoleon ? 'napoleon' : h === r.adjutant ? 'adjutant' : 'allied';
    const won = (role !== 'allied') === r.success;
    s.rounds++; if (won) s.wins++;
    s.byRole[role][won ? 0 : 1]++;
    if (r.solo && role === 'napoleon') s.solo[won ? 0 : 1]++;
    store.set('stats', s);
  }

  // ------------------------------------------------------------------ 巡の結果
  function trickResult() {
    const st = sess.st, lt = st.lastTrick;
    const why = NP.explainWin(lt, sess.names, st.trump);
    const pts = lt.playedPointCount + lt.discardPointCount;
    const wc = WIN_CUTIN[lt.reasonCode];
    if (wc) {
      const show = () => {
        if (!sess || sess.st.lastTrick !== lt) return;
        NP.Fx.cutin(sess.chars[lt.winnerSeat], wc.text, { name: sess.names[lt.winnerSeat], sub: T(`得点札 ${pts}枚ゲット！`, `+${pts} ${pc(pts)}!`), card: cardHtml(lt.winnerCard, { trump: st.trump, cfg: st.cfg }), mood: 'ok', color: wc.color, color2: wc.color2, ms: 2900, win: true });
        S.play('cutinWin');
      };
      const wait = Math.max(0, sess.holdUntil - Date.now());
      if (wait > 30) setTimeout(show, wait); else show();
      hold(wait + 2900 / settings.speed, true);
    }
    const banner = $('#trick-banner');
    banner.innerHTML = `<div class="tb-main">${esc(why)}</div><div class="tb-sub">${T(`得点札 ${lt.playedPointCount}枚${lt.discardPointCount ? `＋初巡なので捨て札の得点札 ${lt.discardPointCount}枚` : ''} → ${esc(sess.names[lt.winnerSeat])}へ（計${pts}枚）`, `${lt.playedPointCount} ${pc(lt.playedPointCount)}${lt.discardPointCount ? ` + ${lt.discardPointCount} from the discards (first trick)` : ''} → ${esc(sess.names[lt.winnerSeat])} (total ${pts})`)}</div>`;
    banner.classList.remove('hidden');
    addLog(T(`${st.trickNo + 1}巡目の勝者：${esc(sess.names[lt.winnerSeat])}（${esc(NP.REASONS[lt.reasonCode])}）`, `Trick ${st.trickNo + 1} winner: ${esc(sess.names[lt.winnerSeat])} (${esc(NP.REASONS[lt.reasonCode])})`), 'dim');
    render();
    if (sess.hooks.onTrickResult && sess.hooks.onTrickResult(lt)) return; // チュートリアルが進行を持つ
    const stop = sess.human != null && settings.stopEachTrick;
    if (stop) { renderActions(); return; }
    const aid = st.actionId;
    later(() => { if (sess && sess.st.actionId === aid) collectNow(); }, withHold(1900, 500));
  }
  // 巡の結果を手で進めてよいか（ボタン・バナー・Enter 共通）。チュートリアルが進行を持っている間は不可
  function canManualCollect() {
    if (!sess || sess.st.phase !== 'TRICK_RESULT') return false;
    if (sess.hooks.onTrickResult && sess.hooks.holdTrick) return false;
    if (sess.hooks.inputLocked && sess.hooks.inputLocked()) return false;
    return true;
  }
  function collectNow() {
    if (!sess || sess.st.phase !== 'TRICK_RESULT') return;
    const w = sess.st.lastTrick.winnerSeat;
    const to = SEAT_C[w];
    const aid = sess.st.actionId;
    if (!settings.reduceMotion) {
      for (const el of $$('#trick-area .slot .card')) {
        const slot = el.closest('.slot');
        const from = SLOT[+slot.dataset.seat];
        el.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(.4)`, opacity: 0.2 }],
          { duration: 420 / settings.speed, easing: 'ease-in', fill: 'forwards' });
      }
    }
    later(() => {
      if (!sess || sess.st.actionId !== aid) return;
      $('#trick-banner').classList.add('hidden');
      act({ type: 'collect' });
    }, settings.reduceMotion ? 50 : 440);
  }

  function redealPrompt() {
    if (sess.human == null || sess.mode === 'demo') {
      toast(T('全員パス。配り直します', 'Everyone passed. Redealing'));
      const aid = sess.st.actionId;
      later(() => { if (sess && sess.st.actionId === aid) act({ type: 'redeal' }); }, 1600);
      return;
    }
    modal(`<div class="m-title">${T('全員パス', 'Everyone Passed')}</div><p>${T('誰も宣言しなかったので、配り直します。<br>局数やポイントは変わりません。', 'Nobody bid, so the cards will be redealt.<br>The round count and points do not change.')}</p>
      <div class="m-buttons"><button class="big-btn yellow" data-act="redeal">${T('配り直す', 'Redeal')}</button></div>`, {
      redeal: () => { closeModal(); act({ type: 'redeal' }); },
    });
  }

  // ------------------------------------------------------------------ 結果
  function roleOf(r, s) { return s === r.napoleon ? 'napoleon' : s === r.adjutant ? 'adjutant' : 'allied'; }
  function soloReasonText(r) {
    if (!r.solo) return '';
    return { self: T('ナポレオンが自分の札を指定したため、1対4の単独戦でした。', 'Napoleon called their own card, so it was a 1-vs-4 solo game.'), kitty: T('指定札は交換札にありました。1対4の単独戦でした。', 'The called card was in the kitty, so it was a 1-vs-4 solo game.'),
      discard: T('指定札は交換札にありました。1対4の単独戦でした。', 'The called card was in the kitty, so it was a 1-vs-4 solo game.') }[r.soloReason] || T('単独戦でした。', 'It was a solo game.');
  }
  function showRoundResult() {
    if (!sess || sess.resultShown) return;
    sess.resultShown = true;
    const st = sess.st, r = st.result, N = sess.names;
    const rows = [0, 1, 2, 3, 4].map((s) => {
      const role = roleOf(r, s);
      return `<tr class="${role}${s === sess.human ? ' me' : ''}"><td>${NP.Art.avatar(sess.chars[s])}</td><td>${esc(N[s])}</td><td>${ROLE_LABEL[role]}</td><td>${r.won[s]}${T('枚', '')}</td>
        <td class="pts">${r.points[s] ? '+' + r.points[s] : '0'}</td>${st.cfg.rounds === 5 ? `<td class="tot">${r.totals[s]}</td>` : ''}</tr>`;
    }).join('');
    const isMatch = st.cfg.rounds === 5;
    const last = isMatch && st.roundNo >= 5;
    const human = sess.human;
    let headline = r.success ? T('ナポレオン軍 勝利！', "Napoleon's Army Wins!") : T('連合軍 勝利！', 'Allies Win!');
    let mine = '';
    if (human != null) {
      const team = roleOf(r, human) !== 'allied';
      mine = team === r.success ? `<div class="m-you win">${T('あなたの勝ち！', 'You win!')}</div>` : `<div class="m-you lose">${T('あなたの負け…', 'You lose...')}</div>`;
    }
    const demo = human == null;
    const html = `<div class="m-title ${r.success ? 'nap' : 'all'}">${headline}</div>${mine}
      <div class="m-summary"><b>${T(`${r.napCount}枚 / 目標${r.target}枚 → ${r.success ? 'ナポレオン軍成功' : 'ナポレオン軍失敗（連合軍の勝ち）'}`, `${r.napCount} / target ${r.target} → ${r.success ? "Napoleon's army succeeded" : "Napoleon's army failed (Allies win)"}`)}</b><br>
      ${T(`ナポレオン：${esc(N[r.napoleon])}（切札${sym(r.trump)}）／ 副官：${r.adjutant != null ? esc(N[r.adjutant]) : 'なし'}（指定札 ${cardNameHtml(r.calledCard)}）`, `Napoleon: ${esc(N[r.napoleon])} (trump ${sym(r.trump)}) / Adjutant: ${r.adjutant != null ? esc(N[r.adjutant]) : 'none'} (called ${cardNameHtml(r.calledCard)})`)}
      ${r.solo ? `<br><span class="m-note">${soloReasonText(r)}</span>` : ''}
      <br><span class="m-row">${T('得点表：', 'Score: ')}${NP.SCORE_ROWS[r.row]}</span></div>
      <table class="result-table"><tr><th></th><th>${T('名前', 'Name')}</th><th>${T('役職', 'Role')}</th><th>${T('得点札', 'Point cards')}</th><th>${T('ポイント', 'Points')}</th>${isMatch ? `<th>${T('累計', 'Total')}</th>` : ''}</tr>${rows}</table>
      <div class="m-buttons">
        <button class="big-btn white" data-act="review">${T('巡の振り返り', 'Trick Review')}</button>
        ${demo ? '' : isMatch ? `<button class="big-btn yellow" data-act="next">${last ? T('最終結果へ', 'Final Results') : T(`第${st.roundNo + 1}局へ`, `Round ${st.roundNo + 1}`)}</button>`
          : `<button class="big-btn yellow" data-act="again">${T('もう一度', 'Play Again')}</button>`}
        ${demo ? '' : `<button class="big-btn white" data-act="title">${T('タイトルへ', 'Title')}</button>`}
      </div>${isMatch ? `<div class="m-foot">${T(`第${st.roundNo}局 / 全5局`, `Round ${st.roundNo} of 5`)}</div>` : ''}`;
    modal(html, {
      review: () => showReview(() => { sess.resultShown = false; showRoundResult(); }),
      next: () => { closeModal(); act({ type: 'next' }); },
      again: () => { closeModal(); const cfg = { ...st.cfg }; startGame({ rounds: 1, cfg }); },
      title: () => { closeModal(); showTitle(); },
    }, { wide: true });
    if (demo) {
      const aid = st.actionId;
      later(() => { if (sess && sess.st.actionId === aid) { closeModal(); act({ type: 'next' }); } }, 4200);
    }
  }
  function showMatchResult() {
    const st = sess.st, N = sess.names;
    const ranks = NP.rankings(st.scores);
    const order = [0, 1, 2, 3, 4].sort((a, b) => ranks[a] - ranks[b] || a - b);
    if (sess.recordStats && sess.human != null && !sess.matchRecorded) {
      sess.matchRecorded = true;
      const s = loadStats(); s.matches++; s.rankSum += ranks[sess.human]; if (ranks[sess.human] === 1) s.firsts++; store.set('stats', s);
    }
    const rows = order.map((s) => `<tr class="${s === sess.human ? 'me' : ''}"><td class="rank">${T(`${ranks[s]}位`, ['', '1st', '2nd', '3rd', '4th', '5th'][ranks[s]])}</td><td>${NP.Art.avatar(sess.chars[s], ranks[s] === 1 ? 'ok' : '')}</td><td>${esc(N[s])}</td><td class="tot">${st.scores[s]}pt</td>
      <td class="hist">${st.roundResults.map((r) => r.points[s]).join(' / ')}</td></tr>`).join('');
    const demo = sess.human == null;
    S.play('win');
    NP.Fx.confetti(960, 300, 90);
    modal(`<div class="m-title">${T('5局マッチ 結果', '5-Round Match Results')}</div>
      ${sess.human != null ? `<div class="m-you ${ranks[sess.human] === 1 ? 'win' : ''}">${T(`あなたは${ranks[sess.human]}位${ranks[sess.human] === 1 ? '！' : ''}`, `You placed ${['', '1st!', '2nd', '3rd', '4th', '5th'][ranks[sess.human]]}`)}</div>` : ''}
      <table class="result-table"><tr><th>${T('順位', 'Rank')}</th><th></th><th>${T('名前', 'Name')}</th><th>${T('合計', 'Total')}</th><th>${T('各局', 'By round')}</th></tr>${rows}</table>
      <div class="m-buttons">${demo ? '' : `<button class="big-btn yellow" data-act="again">${T('もう一度（5局）', 'Play Again (5 rounds)')}</button><button class="big-btn white" data-act="title">${T('タイトルへ', 'Title')}</button>`}</div>`, {
      again: () => { closeModal(); startGame({ rounds: 5, cfg: { ...st.cfg } }); },
      title: () => { closeModal(); showTitle(); },
    }, { wide: true });
    if (demo && sess.hooks.onMatchEnd) sess.hooks.onMatchEnd();
  }

  function trickRowHtml(t, i) {
    const st = sess.st;
    const cards = t.cards.map((x) => `<div class="rv-card ${x.seat === t.winnerSeat ? 'win' : ''}">${cardHtml(x.card, { cls: 'mini', trump: st.trump, cfg: st.cfg })}<span>${esc(sess.names[x.seat])}</span></div>`).join('');
    return `<div class="rv-row"><div class="rv-no">${T(`${t.trickNo + 1}巡目`, `Trick ${t.trickNo + 1}`)}<small>${T('先手', 'Lead')} ${esc(sess.names[t.leader])}${t.requestedSuit ? `<br>${T('要求', 'Called')}${sym(t.requestedSuit)}` : ''}</small></div>
      <div class="rv-cards">${cards}</div><div class="rv-why">${esc(NP.explainWin(t, sess.names, st.trump))}<br><b>${T(`得点札 ${t.playedPointCount + t.discardPointCount}枚`, `${t.playedPointCount + t.discardPointCount} ${pc(t.playedPointCount + t.discardPointCount)}`)}</b>${t.discardPointCount ? T(`（捨て札分 ${t.discardPointCount}枚を含む）`, ` (incl. ${t.discardPointCount} from the discards)`) : ''}</div></div>`;
  }
  function showReview(back) {
    const st = sess.st;
    const list = st.tricks.slice();
    if (st.phase === 'TRICK_RESULT' && st.lastTrick && !list.includes(st.lastTrick)) list.push(st.lastTrick);
    modal(`<div class="m-title">${T('巡の振り返り', 'Trick Review')}</div><div class="review">${list.length ? list.map(trickRowHtml).join('') : `<p>${T('まだ巡はありません。', 'No tricks yet.')}</p>`}</div>
      <div class="m-buttons"><button class="big-btn yellow" data-act="close">${T('閉じる', 'Close')}</button></div>`, {
      close: () => { closeModal(); if (back) back(); },
    }, { wide: true });
  }
  function showLastTrick() {
    if (!sess) return;
    const st = sess.st;
    const t = st.phase === 'TRICK_RESULT' ? st.lastTrick : st.tricks[st.tricks.length - 1];
    if (!t) { toast(T('まだ取り終えた巡はありません', 'No completed tricks yet')); return; }
    modal(`<div class="m-title">${T('直前の巡', 'Last Trick')}</div><div class="review">${trickRowHtml(t)}</div>
      <div class="m-buttons"><button class="big-btn white" data-act="all">${T('すべての巡', 'All Tricks')}</button><button class="big-btn yellow" data-act="close">${T('閉じる', 'Close')}</button></div>`, {
      close: closeModal, all: () => showReview(),
    }, { wide: true });
  }

  // ------------------------------------------------------------------ モーダル
  function modal(html, actions = {}, opts = {}) {
    const layer = $('#modal-layer');
    layer.innerHTML = `<div class="modal-back"><div class="modal ${opts.wide ? 'wide' : ''}">${html}</div></div>`;
    for (const b of $$('[data-act]', layer)) {
      b.addEventListener('click', (e) => { S.play('click'); const f = actions[b.dataset.act]; if (f) f(e, b); });
    }
    if (opts.onBack) $('.modal-back', layer).addEventListener('click', (e) => { if (e.target.classList.contains('modal-back')) opts.onBack(); });
    const first = $('.big-btn.yellow', layer) || $('button', layer);
    if (first) setTimeout(() => first.focus(), 30);
    return layer;
  }
  function closeModal() { $('#modal-layer').innerHTML = ''; }
  const modalOpen = () => !!$('#modal-layer .modal');

  // ------------------------------------------------------------------ 描画
  function obs() { return sess.human != null ? NP.getObservation(sess.st, sess.human) : null; }

  function render() {
    if (!sess) return;
    renderTop(); renderSeats(); renderTrick(); renderDiscards(); renderCenter(); $('#center-panel').classList.toggle('locked', !!(sess.hooks.inputLocked && sess.hooks.inputLocked())); renderHand(); renderActions(); renderGoal(); renderHint();
    if (!$('#log-panel').classList.contains('hidden')) renderLog();
    renderSpectate();
  }

  function renderTop() {
    const st = sess.st;
    const rn = st.phase === 'BIDDING' || st.phase === 'REDEAL_WAIT' ? st.roundNo + 1 : st.roundNo;
    const trickTxt = ['PLAY', 'TRICK_RESULT'].includes(st.phase) ? T(`<span class="sep">｜</span><b>${st.trickNo + 1}</b>巡目`, `<span class="sep">｜</span>Trick <b>${st.trickNo + 1}</b>`) : '';
    $('#top-left').innerHTML = sess.mode === 'tutorial' ? T('チュートリアル', 'Tutorial') : `${st.cfg.rounds === 5 ? T(`第<b>${rn}</b>局<small>/5</small>`, `Round <b>${rn}</b><small>/5</small>`) : T('1局勝負', 'Single Round')}${trickTxt}`;
    const parts = [];
    if (st.trump) {
      parts.push(`<div class="ib"><small>${T('切札', 'Trump')}</small>${symHtml(st.trump)}<span class="ib-sub">${Cards.SUIT_NAME[st.trump]}</span></div>`);
      parts.push(`<div class="ib"><small>${T('目標', 'Goal')}</small><b>${st.target}</b>${T('枚', '')}</div>`);
    } else if (st.currentBid) {
      parts.push(`<div class="ib"><small>${T('宣言', 'Bid')}</small>${symHtml(st.currentBid.suit)}<b>${st.currentBid.count}</b><span class="ib-sub">${esc(sess.names[st.currentBid.seat])}</span></div>`);
    } else parts.push(`<div class="ib"><small>${T('競り', 'Bid')}</small><span class="ib-sub">${T(`最低${st.cfg.minBid}枚`, `min ${st.cfg.minBid}`)}</span></div>`);
    if (st.calledCard) {
      const nm = Cards.roleName(st.calledCard, st.trump, st.cfg);
      parts.push(`<div class="ib called"><small>${T('副官札', 'Called')}</small>${cardHtml(st.calledCard, { cls: 'tiny' })}<span class="ib-sub">${nm || ''}</span></div>`);
    }
    const o = obs();
    if (o && o.role) {
      const r = o.role;
      parts.push(`<div class="ib role ${r}"><small>${T('あなた', 'You')}</small><b>${ROLE_LABEL[r]}</b></div>`);
    }
    $('#info-band').innerHTML = parts.join('');
    // 集計
    const tally = $('#tally');
    if (st.napoleon == null || !['PLAY', 'TRICK_RESULT', 'ROUND_RESULT', 'MATCH_RESULT'].includes(st.phase)) { tally.innerHTML = ''; return; }
    const po = NP.getObservation(st, sess.human != null ? sess.human : 0);
    const t = NP.publicTally(po);
    const pend = t.pending ? `<div class="t-pend">${T(`初巡の勝者へ：得点札${t.pending}枚`, `To the first trick's winner: ${t.pending} ${pc(t.pending)}`)}</div>` : '';
    if (t.mode === 'teams') {
      const pct = Math.min(100, (t.napTeam / st.target) * 100);
      tally.innerHTML = `<div class="t-row"><span class="t-nap">${t.solo ? T('ナポレオン（単独）', 'Napoleon (solo)') : T('ナポレオン軍', "Napoleon's army")} <b>${t.napTeam}</b>${T('枚', '')}</span><span class="t-slash">${T(`/ 目標${st.target}`, `/ goal ${st.target}`)}</span><span class="t-all">${T('連合軍', 'Allies')} <b>${t.allied}</b>${T('枚', '')}</span></div>
        <div class="t-bar"><i style="width:${pct}%"></i></div>${pend}`;
    } else {
      tally.innerHTML = `<div class="t-row"><span class="t-nap">${T('ナポレオン本人', 'Napoleon')} <b>${t.napoleonSelf}</b>${T('枚', '')}</span><span class="t-all">${T('ほか4人', 'Other 4')} <b>${t.others}</b>${T('枚', '')}</span></div>
        <div class="t-note">${T(`軍の合計は副官判明後 ・ 目標${st.target}枚`, `Team totals shown once the adjutant is revealed · goal ${st.target}`)}</div>${pend}`;
    }
  }

  function publicRole(s) {
    const st = sess.st;
    if (st.napoleon == null) return null;
    if (s === st.napoleon) return st.soloRevealed ? 'napoleon solo' : 'napoleon';
    const done = ['ROUND_RESULT', 'MATCH_RESULT'].includes(st.phase);
    if (st.adjutantRevealed || done) {
      if (!st.solo && s === st.adjutant) return 'adjutant';
      return 'allied';
    }
    if (st.soloRevealed) return 'allied';
    if (st.calledCard && s === sess.human) return st.adjutant === s ? 'adjutant self' : 'allied self';
    if (sess.revealAll && st.calledCard) return (st.adjutant === s ? 'adjutant' : 'allied') + ' peek';
    return null;
  }

  function renderSeats() {
    const st = sess.st;
    const now = Date.now();
    for (let s = 0; s < 5; s++) {
      const el = $(`.seat[data-seat="${s}"]`);
      const role = publicRole(s);
      let roleHtml = '';
      if (role) {
        const base = role.split(' ')[0];
        let label = ROLE_LABEL[base].slice(2); // 記号は顔アイコンのバッジで示す
        if (role.includes('solo')) label += `<span class="secret">${T('単独', 'solo')}</span>`;
        if (role.includes('self')) label += `<span class="secret" title="${T('あなただけが知っています', 'Only you know this')}">${T('秘密', 'secret')}</span>`;
        if (role.includes('peek')) label += `<span class="secret" title="${T('観戦表示（ほかの人には見えていません）', 'Spectator view (hidden from players)')}">${T('観戦', 'peek')}</span>`;
        roleHtml = `<div class="seat-role ${base}">${label}</div>`;
      }
      const turn = actorOf(st) === s && !['TRICK_RESULT'].includes(st.phase);
      const b = sess.bubbles[s];
      const bubble = b && b.until > now ? `<div class="bubble">${esc(b.text)}</div>` : '';
      const won = st.wonCards[s];
      let peek = '';
      if (sess.revealAll && s !== sess.human) peek = `<div class="peek-hand">${Cards.sortHand(st.hands[s], st.trump).map((c) => cardHtml(c, { cls: 'micro' })).join('')}</div>`;
      el.className = `seat${turn ? ' turn' : ''}${st.napoleon === s ? ' is-nap' : ''}${role && role.startsWith('adjutant') && !role.includes('self') && !role.includes('peek') ? ' is-adj' : ''}${s === sess.human ? ' is-me' : ''}`;
      const cc = NP.Art.colors(sess.chars[s]);
      el.style.setProperty('--cc1', cc[0]); el.style.setProperty('--cc2', cc[1]);
      const pub = role ? role.split(' ')[0] : '';
      const badge = pub === 'napoleon' ? `<div class="seat-badge napoleon" title="${T('ナポレオン', 'Napoleon')}">♛</div>` : pub === 'adjutant' && !role.includes('peek') ? `<div class="seat-badge adjutant" title="${T('副官', 'Adjutant')}">★</div>` : '';
      el.innerHTML = `<div class="seat-inner">
        <div class="avatar">${NP.Art.avatar(sess.chars[s])}</div>${badge}
        <div class="seat-info">
          <div class="seat-name">${esc(sess.names[s])}${st.dealer === s ? `<span class="dealer" title="${T('親（配った人）', 'Dealer')}">${T('親', 'D')}</span>` : ''}</div>
          ${roleHtml}
          <div class="seat-stats"><span title="${T('手札の枚数', 'Cards in hand')}">${T('手札', 'Hand')}<b>${st.hands[s].length}</b></span><span class="won" title="${won.map(cardName).join(' ')}">${T('獲得', 'Won')}<b>${won.length}</b></span></div>
        </div>${turn ? `<div class="turn-mark">${T('▶ 手番', '▶ Turn')}</div>` : ''}${bubble}</div>${peek}`;
    }
  }

  function provisionalBest(st) {
    if (!st.trick.length || st.phase !== 'PLAY') return null;
    return NP.resolveTrick(st.trick, { trump: st.trump, requestedSuit: st.requestedSuit, trickNo: st.trickNo, cfg: st.cfg });
  }

  function renderTrick() {
    const st = sess.st;
    const area = $('#trick-area');
    if (!['PLAY', 'TRICK_RESULT'].includes(st.phase)) { area.innerHTML = ''; $('#trick-banner').classList.add('hidden'); return; }
    const best = st.phase === 'TRICK_RESULT' ? st.lastTrick : provisionalBest(st);
    const parts = [];
    for (let s = 0; s < 5; s++) {
      const x = st.trick.find((y) => y.seat === s);
      const p = SLOT[s];
      const isBest = best && best.winnerSeat === s && x;
      const lead = st.trick.length && st.trick[0].seat === s;
      parts.push(`<div class="slot${isBest ? ' best' : ''}${st.phase === 'TRICK_RESULT' && isBest ? ' final' : ''}" data-seat="${s}" style="left:${p.x}px; top:${p.y}px">
        ${x ? cardHtml(x.card, { trump: st.trump, cfg: st.cfg }) : `<div class="slot-empty">${actorOf(st) === s ? '…' : ''}</div>`}
        <div class="slot-name">${lead ? `<i>${T('先手', 'Lead')}</i>` : ''}${esc(sess.names[s])}</div>
        ${isBest ? `<div class="best-tag">${st.phase === 'TRICK_RESULT' ? T('勝ち', 'Wins') : T('暫定トップ', 'Winning')}</div>` : ''}</div>`);
    }
    let req = '';
    if (st.trick.length && st.trick[0].card === 'JK' && st.requestedSuit) req = `<div class="req-tag">${T('要求マーク', 'Called suit')} ${symHtml(st.requestedSuit)}</div>`;
    else if (NP.isJokerRequest(st.trick, st.cfg) && st.phase === 'PLAY') req = `<div class="req-tag jr">${T('ジョーカー請求中（♣3）', 'Joker Call (♣3)')}</div>`;
    else if (st.trick.length) req = `<div class="req-tag">${T('台札', 'Lead')} ${symHtml(NP.followSuitOf(st.trick, st.requestedSuit))}</div>`;
    const note = best && st.phase === 'PLAY' && st.trick.length < 5 ? `<div class="prov-note">${T(`「暫定トップ」は後から${st.cfg.yoromeki ? 'よろめき・' : ''}${st.cfg.same2 !== 'off' ? 'セイム2・' : ''}強い札で変わることがあります`, '"Winning" can still change — a stronger card, a Swoon or a Same Two may come later')}</div>` : '';
    area.innerHTML = parts.join('') + req + note;
  }

  function renderDiscards() {
    const st = sess.st;
    const el = $('#discard-area');
    if (!st.discards.length || !['PLAY', 'TRICK_RESULT', 'ROUND_RESULT'].includes(st.phase)) { el.innerHTML = ''; return; }
    const pub = st.discards.filter(Cards.isPoint);
    const hidden = st.discards.length - pub.length;
    const iAmNap = sess.human != null && sess.human === st.napoleon;
    const cards = iAmNap ? st.discards.map((c) => cardHtml(c, { cls: 'mini' + (Cards.isPoint(c) ? '' : ' own-hidden') })).join('')
      : pub.map((c) => cardHtml(c, { cls: 'mini' })).join('') + Array.from({ length: hidden }, () => cardHtml('', { back: true, cls: 'mini' })).join('');
    el.innerHTML = `<div class="dz-title">${T('ナポレオンの捨て札', "Napoleon's discards")}</div><div class="dz-cards">${cards}</div>
      <div class="dz-note">${st.discardsCollected ? T(`${esc(sess.names[st.tricks[0] ? st.tricks[0].winnerSeat : 0])}が初巡で回収済み`, `Taken by ${esc(sess.names[st.tricks[0] ? st.tricks[0].winnerSeat : 0])} in the first trick`) : pub.length ? T(`得点札${pub.length}枚は最初の巡の勝者へ`, (pub.length === 1 ? "1 point card goes to the first trick's winner" : `${pub.length} point cards go to the first trick's winner`)) : T('得点札なし（裏向きは非公開）', 'No point cards (face-down cards stay hidden)')}${iAmNap && hidden ? T('<br>（裏向きの札はあなただけが見えます）', '<br>(Only you can see the face-down cards)') : ''}</div>`;
  }

  // 中央パネル：競り・副官指定・交換・ジョーカーの要求マーク
  function renderCenter() {
    const st = sess.st;
    const el = $('#center-panel');
    const me = sess.human;
    el.className = 'hidden';
    if (st.phase === 'BIDDING') {
      el.className = 'cp-bid';
      const myTurn = st.turn === me;
      const hist = st.bids.slice(-8).map((b) => `<span class="bh ${b.pass ? 'pass' : ''}">${esc(sess.names[b.seat])}：${b.pass ? T('パス', 'Pass') : sym(b.suit) + b.count}</span>`).join('');
      if (!myTurn) {
        el.innerHTML = `<div class="cp-title">${T('ナポレオンの立候補（競り）', 'Bidding for Napoleon')}</div>
          <div class="cp-goal">${T('マーク＋目標枚数を宣言します。いちばん強い宣言をした人がナポレオンです。', 'Players bid a suit and a target number of point cards. The highest bidder becomes Napoleon.')}</div>
          <div class="cp-status">${st.currentBid ? T(`現在の宣言：${symHtml(st.currentBid.suit)}<b>${st.currentBid.count}</b>枚（${esc(sess.names[st.currentBid.seat])}）`, `Current bid: ${symHtml(st.currentBid.suit)}<b>${st.currentBid.count}</b> (${esc(sess.names[st.currentBid.seat])})`) : T('まだ宣言はありません', 'No bids yet')}</div>
          <div class="cp-wait">${T(`${esc(sess.names[st.turn])}が考えています…`, `${esc(sess.names[st.turn])} is thinking...`)}</div><div class="bid-hist">${hist}</div>`;
        return;
      }
      const legal = NP.getLegalActions(st, me).filter((a) => a.type === 'bid');
      const minFor = (s) => { const l = legal.filter((a) => a.suit === s); return l.length ? Math.min(...l.map((a) => a.count)) : null; };
      if (!sess.bidSuit || minFor(sess.bidSuit) == null) {
        const h = sess.lastHint && sess.lastHint.action.type === 'bid' ? sess.lastHint.action.suit : null;
        sess.bidSuit = h && minFor(h) != null ? h : Cards.SUITS.find((s) => minFor(s) != null);
      }
      const minC = sess.bidSuit ? minFor(sess.bidSuit) : null;
      if (sess.bidCount == null || minC == null || sess.bidCount < minC) sess.bidCount = minC;
      const count = sess.bidCount;
      el.innerHTML = `<div class="cp-title">${T('あなたの番：ナポレオンに立候補？', 'Your turn: bid or pass?')}</div>
        <div class="cp-goal">${T('2人（ナポレオン＋秘密の副官）で、得点札を何枚取れるか宣言します。強さは枚数→同じ枚数なら ♠＞♥＞♦＞♣。', 'Bid how many point cards you and your secret adjutant will take. Higher number wins; ties go ♠ > ♥ > ♦ > ♣.')}</div>
        <div class="cp-status">${st.currentBid ? T(`現在の宣言：${symHtml(st.currentBid.suit)}<b>${st.currentBid.count}</b>枚（${esc(sess.names[st.currentBid.seat])}）`, `Current bid: ${symHtml(st.currentBid.suit)}<b>${st.currentBid.count}</b> (${esc(sess.names[st.currentBid.seat])})`) : T(`最低${st.cfg.minBid}枚から宣言できます`, `Minimum bid: ${st.cfg.minBid}`)}</div>
        <div class="bid-suits">${Cards.SUITS.map((s) => `<button class="suit-btn ${s === sess.bidSuit ? 'on' : ''}" data-suit="${s}" ${minFor(s) == null ? 'disabled' : ''}>${symHtml(s)}<small>${Cards.SUIT_NAME[s]}<br>${minFor(s) == null ? T('宣言不可', 'n/a') : T(minFor(s) + '枚〜', minFor(s) + '+')}</small></button>`).join('')}</div>
        <div class="bid-count"><button class="step-btn" data-d="-1" ${!count || count <= minC ? 'disabled' : ''}>−</button><div class="count-val">${count ? `${symHtml(sess.bidSuit)}<b>${count}</b>${T('枚', '')}` : '—'}</div><button class="step-btn" data-d="1" ${!count || count >= 20 ? 'disabled' : ''}>＋</button></div>
        <div class="cp-buttons"><button class="big-btn yellow" id="do-bid" ${count ? '' : 'disabled'}>${count ? T(`${sym(sess.bidSuit)}${count}枚で宣言`, `Bid ${sym(sess.bidSuit)}${count}`) : T('宣言できません', 'Cannot bid')}</button><button class="big-btn white" id="do-pass">${T('パス', 'Pass')}</button></div>
        <div class="bid-hist">${hist}</div>`;
      for (const b of $$('.suit-btn', el)) b.onclick = () => { S.play('select'); sess.bidSuit = b.dataset.suit; sess.bidCount = null; renderCenter(); };
      for (const b of $$('.step-btn', el)) b.onclick = () => { S.play('click'); sess.bidCount = Math.max(minC, Math.min(20, sess.bidCount + +b.dataset.d)); renderCenter(); };
      $('#do-bid', el).onclick = () => { if (count) act({ type: 'bid', seat: me, suit: sess.bidSuit, count }); };
      $('#do-pass', el).onclick = () => act({ type: 'pass', seat: me });
      return;
    }
    if (st.phase === 'CALL_ADJUTANT') {
      el.className = 'cp-call';
      if (st.napoleon !== me) {
        el.className = 'cp-bid';
        el.innerHTML = `<div class="cp-title">${T('副官の指定', 'Calling the Adjutant')}</div><div class="cp-goal">${T(`ナポレオン（${esc(sess.names[st.napoleon])}）が、秘密の味方になる札を1枚指定します。`, `Napoleon (${esc(sess.names[st.napoleon])}) names one card. Whoever holds it becomes the secret partner.`)}</div><div class="cp-wait">${T('考えています…', 'Thinking...')}</div>`;
        return;
      }
      const t = st.trump, L = Cards.LEFT_SUIT[t];
      const shortcuts = [['S14', T('マイティ', 'Mighty')], ['JK', T('ジョーカー', 'Joker')], [t + '11', T('正ジャック', 'Right Jack')], [L + '11', T('裏ジャック', 'Left Jack')]];
      for (const r of [14, 13, 12]) if (t + r !== 'S14') shortcuts.push([t + r, T('切札', 'Trump ') + Cards.rankLabel(r)]);
      const myHand = st.hands[me];
      const sel = sess.callSel;
      const grid = Cards.SUITS.map((s) => `<div class="cg-row"><span class="cg-suit">${symHtml(s)}</span>${[14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((r) => {
        const c = s + r;
        return `<button class="cg-card ${c === sel ? 'on' : ''} ${myHand.includes(c) ? 'mine' : ''} ${Cards.isRed(c) ? 'red' : ''}" data-card="${c}" title="${cardName(c)}${myHand.includes(c) ? T('（あなたの手札）', ' (in your hand)') : ''}">${Cards.rankLabel(r)}${myHand.includes(c) ? `<i>${T('手札', 'yours')}</i>` : ''}</button>`;
      }).join('')}</div>`).join('');
      el.innerHTML = `<div class="cp-title">${T('副官を指定する札を選ぶ', 'Choose the Adjutant Card')}</div>
        <div class="cp-goal">${T('この札を持つ人が、秘密の味方（副官）になります。人ではなく札を指定します。交換札の中にあれば1対4になります。', 'Whoever holds this card becomes your secret partner (the adjutant). You name a card, not a player. If it is in the kitty, you play 1 vs 4.')}</div>
        <div class="cg-short">${shortcuts.map(([c, n]) => `<button class="sc-btn ${c === sel ? 'on' : ''} ${myHand.includes(c) ? 'mine' : ''}" data-card="${c}">${cardNameHtml(c)}<small>${n}${myHand.includes(c) ? T('・手札', ' · yours') : ''}</small></button>`).join('')}</div>
        <div class="cg-grid">${grid}<div class="cg-row"><span class="cg-suit">JK</span><button class="cg-card wide ${sel === 'JK' ? 'on' : ''} ${myHand.includes('JK') ? 'mine' : ''}" data-card="JK">${T('ジョーカー', 'Joker')}${myHand.includes('JK') ? `<i>${T('手札', 'yours')}</i>` : ''}</button></div></div>
        <div class="cp-buttons"><div class="cg-sel">${sel ? `${T('指定：', 'Call: ')}${cardNameHtml(sel)} ${Cards.roleName(sel, t, st.cfg) ? `(${Cards.roleName(sel, t, st.cfg)})` : ''}` : T('札を選んでください', 'Choose a card')}</div>
        <button class="big-btn yellow" id="do-call" ${sel ? '' : 'disabled'}>${T('この札を指定', 'Call This Card')}</button></div>`;
      for (const b of $$('[data-card]', el)) b.onclick = () => { S.play('select'); sess.callSel = b.dataset.card; renderCenter(); };
      $('#do-call', el).onclick = () => {
        if (!sess.callSel) return;
        const c = sess.callSel;
        if (myHand.includes(c)) {
          modal(`<div class="m-title">${T('確認', 'Confirm')}</div><p>${T(`この札（${cardNameHtml(c)}）はあなたが持っています。<br><b>1対4の単独戦</b>になります。よろしいですか？`, `You hold this card (${cardNameHtml(c)}).<br>You will play a <b>1-vs-4 solo game</b>. Are you sure?`)}</p>
            <div class="m-buttons"><button class="big-btn white" data-act="no">${T('選び直す', 'Choose Again')}</button><button class="big-btn yellow" data-act="yes">${T('単独戦で指定', 'Go Solo')}</button></div>`, {
            no: closeModal, yes: () => { closeModal(); act({ type: 'call', seat: me, card: c }); },
          });
        } else act({ type: 'call', seat: me, card: c });
      };
      return;
    }
    if (st.phase === 'EXCHANGE') {
      el.className = 'cp-bid cp-ex';
      if (st.napoleon !== me) {
        el.innerHTML = `<div class="cp-title">${T('交換', 'Exchange')}</div><div class="cp-goal">${T(`ナポレオン（${esc(sess.names[st.napoleon])}）が交換札3枚を手札に加え、3枚捨てます。<br>得点札を捨てると表向きになり、最初の巡の勝者が取ります。`, `Napoleon (${esc(sess.names[st.napoleon])}) takes the 3-card kitty and discards 3.<br>Discarded point cards are shown face up and go to the first trick's winner.`)}</div><div class="cp-wait">${T('考えています…', 'Thinking...')}</div>`;
        return;
      }
      const sel = sess.sel;
      const pts = sel.filter(Cards.isPoint).length;
      el.innerHTML = `<div class="cp-title">${T('交換：3枚捨てる', 'Exchange: Discard 3')}</div>
        <div class="cp-goal">${T('交換札3枚（<span class="new-mark">NEW</span>）を加えた13枚から、3枚を選んで捨てます。', 'You added the 3-card kitty (<span class="new-mark">NEW</span>). Pick 3 of your 13 cards to discard.')}</div>
        <div class="cp-status">${T(`あと <b>${3 - sel.length}</b> 枚選んでください`, `Choose <b>${3 - sel.length}</b> more`)}</div>
        <div class="ex-note">${pts ? T(`捨てる得点札${pts}枚は、最初の巡の勝者が取ります（表向きで公開）`, (pts === 1 ? "The point card you discard goes to the first trick's winner (shown face up)" : `The ${pts} point cards you discard go to the first trick's winner (shown face up)`)) : T('得点札を捨てると表向きで公開され、最初の巡の勝者が取ります', "Discarded point cards are shown face up and go to the first trick's winner")}</div>
        ${sel.includes(st.calledCard) ? `<div class="ex-note warn">${T(`指定札（${cardNameHtml(st.calledCard)}）を捨てようとしています${Cards.isPoint(st.calledCard) ? '。表向きになるので単独戦が全員に知られます' : ''}`, `You are discarding the called card (${cardNameHtml(st.calledCard)})${Cards.isPoint(st.calledCard) ? '. It will be face up, so everyone will know you are solo' : ''}`)}</div>` : ''}`;
      return;
    }
    if (st.phase === 'PLAY' && sess.jokerPick && st.turn === me) {
      el.className = 'cp-bid cp-joker';
      el.innerHTML = `<div class="cp-title">${T('ジョーカーで先手', 'Leading the Joker')}</div><div class="cp-goal">${T('ほかの人に出してほしいマークを1つ指定します。<br>持っている人はそのマークを出します（無ければ何でも）。', 'Name one suit the others must play.<br>Anyone holding that suit must follow (otherwise anything).')}</div>
        <div class="bid-suits">${Cards.SUITS.map((s) => `<button class="suit-btn" data-suit="${s}">${symHtml(s)}<small>${Cards.SUIT_NAME[s]}${s === st.trump ? T('<br>（切札）', '<br>(trump)') : ''}</small></button>`).join('')}</div>
        <div class="cp-buttons"><button class="big-btn white" id="jk-cancel">${T('やめる', 'Cancel')}</button></div>`;
      for (const b of $$('.suit-btn', el)) b.onclick = () => act({ type: 'play', seat: me, card: 'JK', requestedSuit: b.dataset.suit });
      $('#jk-cancel', el).onclick = () => { sess.jokerPick = false; render(); };
    }
  }

  function myLegalCards() {
    const st = sess.st, me = sess.human;
    if (st.phase !== 'PLAY' || st.turn !== me) return null;
    return NP.legalPlays(st.hands[me], st.trick, st.requestedSuit, st.cfg);
  }

  function renderHand() {
    const st = sess.st, me = sess.human;
    const el = $('#my-hand');
    if (me == null || !['BIDDING', 'CALL_ADJUTANT', 'EXCHANGE', 'PLAY', 'TRICK_RESULT', 'REDEAL_WAIT'].includes(st.phase)) { el.innerHTML = ''; el.className = ''; return; }
    const hand = Cards.sortHand(st.hands[me], st.trump);
    sess.handOrder = hand;
    const ex = st.phase === 'EXCHANGE' && st.napoleon === me;
    const legal = myLegalCards();
    const allow = sess.hooks.allowCard;
    const kittyNew = ex ? (sess.kittyCards || []) : [];
    el.className = ex ? 'exchange' : hand.length > 10 ? 'many' : hand.length <= 7 ? 'few' : '';
    el.innerHTML = hand.map((c, i) => {
      const dim = (legal && !legal.includes(c)) || (legal && allow && !allow(c));
      const sel = sess.sel.includes(c);
      const extra = (kittyNew.includes(c) ? ' new' : '') + (i === sess.focus && !ex ? ' focus' : '');
      return cardHtml(c, { idx: i, dim, sel, cls: 'hand-card' + extra, trump: st.trump, cfg: st.cfg });
    }).join('');
    for (const n of $$('.card', el)) n.onclick = () => onCardClick(n.dataset.card);
  }

  function onCardClick(c) {
    if (!sess || modalOpen()) return;
    const st = sess.st, me = sess.human;
    S.ensure && S.ensure();
    if (sess.hooks.inputLocked && sess.hooks.inputLocked()) { toast(esc(T('コーチの説明を読んで「つぎへ」を押してください。', "Read the coach's message and press Next."))); return; }
    if (st.phase === 'EXCHANGE' && st.napoleon === me) {
      if (sess.sel.includes(c)) sess.sel = sess.sel.filter((x) => x !== c);
      else if (sess.sel.length < 3) sess.sel.push(c);
      else { toast(T('捨てるのは3枚です。選び直すときは選んだ札をもう一度押します', 'Discard exactly 3. Tap a selected card again to unselect it')); return; }
      S.play('select');
      render();
      return;
    }
    if (st.phase !== 'PLAY' || st.turn !== me) {
      if (st.phase === 'PLAY') toast(esc(turnOf(sess.names[st.turn])));
      return;
    }
    const legal = myLegalCards();
    if (!legal.includes(c)) {
      S.play('error');
      showReason(NP.illegalReason(c, st.hands[me], st.trick, st.requestedSuit, st.cfg));
      return;
    }
    if (sess.hooks.allowCard && !sess.hooks.allowCard(c)) { S.play('error'); showReason(sess.hooks.denyText || T('チュートリアルでは、コーチの指示した札を出してください。', 'In the tutorial, play the card the coach asks for.')); return; }
    if (sess.sel[0] === c) { confirmPlay(); return; } // 2回押すと出す
    sess.sel = [c];
    sess.focus = sess.handOrder.indexOf(c);
    S.play('select');
    renderHand(); renderActions();
  }
  function showReason(text) {
    const g = $('#goal');
    g.innerHTML = `<span class="why">${T('出せない理由：', "Can't play: ")}${esc(text)}</span>`;
    g.classList.add('warn');
    // セッションに紐づけたタイマー（終了で解除。別の対戦には影響しない）
    if (sess.reasonTimer) { clearTimeout(sess.reasonTimer); sess.timers.delete(sess.reasonTimer); }
    sess.reasonTimer = later(() => { sess.reasonTimer = null; g.classList.remove('warn'); renderGoal(); }, 4200 * settings.speed);
  }
  function confirmPlay() {
    const st = sess.st, me = sess.human;
    if (st.phase === 'EXCHANGE' && st.napoleon === me) {
      if (sess.sel.length !== 3) { toast(T('3枚選んでください', 'Choose 3 cards')); return; }
      act({ type: 'exchange', seat: me, discards: sess.sel.slice() });
      return;
    }
    if (st.phase !== 'PLAY' || st.turn !== me || !sess.sel.length) return;
    const c = sess.sel[0];
    if (c === 'JK' && !st.trick.length) { sess.jokerPick = true; render(); return; }
    act({ type: 'play', seat: me, card: c });
  }

  function renderActions() {
    const st = sess.st, me = sess.human;
    const el = $('#action-bar');
    let html = '';
    const myTurn = me != null && actorOf(st) === me && !(sess.hooks.inputLocked && sess.hooks.inputLocked());
    $('#my-hand').classList.toggle('myturn', myTurn);
    if (me != null && canManualCollect() && settings.stopEachTrick) {
      html = `<button class="big-btn yellow" id="ab-next">${T('次へ ▶', 'Next ▶')}</button>`;
    } else if (sess.hooks.inputLocked && sess.hooks.inputLocked()) {
      html = '';
    } else if (st.phase === 'PLAY' && st.turn === me && !sess.jokerPick) {
      const c = sess.sel[0];
      html = `<div class="ab-sel">${c ? `${T('選択中：', 'Selected: ')}${cardNameHtml(c)}` : T('札を選んでください', 'Choose a card')}</div>
        <div class="ab-row"><button class="big-btn yellow" id="ab-play" ${c ? '' : 'disabled'}>${c === 'JK' && !st.trick.length ? T('マーク指定', 'Call Suit') : T('出す', 'Play')}<small>Enter</small></button>
        <button class="big-btn white small" id="ab-clear" ${c ? '' : 'disabled'}>${T('解除', 'Clear')}<small>Esc</small></button></div>`;
    } else if (st.phase === 'EXCHANGE' && st.napoleon === me) {
      html = `<div class="ab-sel">${sess.sel.length}/3</div><div class="ab-row"><button class="big-btn yellow" id="ab-ex" ${sess.sel.length === 3 ? '' : 'disabled'}>${T('3枚を捨てる', 'Discard 3')}</button>
        <button class="big-btn white small" id="ab-clear" ${sess.sel.length ? '' : 'disabled'}>${T('解除', 'Clear')}</button></div>`;
    }
    if (myTurn) html = `<div class="ab-turn">YOUR TURN<small>${T('あなたの番です', "It's your move")}</small></div>` + html;
    el.innerHTML = html;
    const on = (id, f) => { const b = $(id, el); if (b) b.onclick = f; };
    on('#ab-next', () => collectNow());
    on('#ab-play', confirmPlay);
    on('#ab-ex', confirmPlay);
    on('#ab-clear', () => { sess.sel = []; S.play('click'); render(); });
  }

  function renderGoal() {
    const st = sess.st, me = sess.human;
    const g = $('#goal');
    if (g.classList.contains('warn')) return;
    let t = '';
    const N = sess.names;
    if (sess.hooks.goalText) t = sess.hooks.goalText(st) || '';
    if (!t) {
      if (st.phase === 'PLAY') {
        if (st.turn === me) {
          if (!st.trick.length) t = st.trickNo === 0 ? T('あなたが先手（ナポレオンは最初の巡の先手）。好きな札を出せます', 'You lead (Napoleon leads the first trick). Play any card') : T('あなたが先手です。好きな札を出せます', 'You lead. Play any card');
          else if (NP.isJokerRequest(st.trick, st.cfg) && st.hands[me].includes('JK')) t = T('<b>ジョーカー請求！</b> ジョーカーを出す必要があります', '<b>Joker Call!</b> You must play the Joker');
          else {
            const fs = NP.followSuitOf(st.trick, st.requestedSuit);
            const has = st.hands[me].some((c) => c !== 'JK' && Cards.suit(c) === fs);
            t = has ? T(`${symHtml(fs)}があるので、${symHtml(fs)}の中から選びます${st.hands[me].includes('JK') ? '（ジョーカーはいつでも出せます）' : ''}`, `You have ${symHtml(fs)}, so follow with ${symHtml(fs)}${st.hands[me].includes('JK') ? ' (the Joker is always allowed)' : ''}`) : T(`${symHtml(fs)}がないので、どの札でも出せます。切札${symHtml(st.trump)}なら勝てるかも`, `No ${symHtml(fs)}, so any card goes. A trump ${symHtml(st.trump)} might win it`);
          }
        } else t = esc(turnOf(N[st.turn]));
      } else if (st.phase === 'TRICK_RESULT') t = '';

    }
    g.innerHTML = t;
  }

  function renderHint() {
    const box = $('#hint-box');
    $('#btn-hint b').textContent = sess && sess.hintOn ? 'ON' : 'OFF';
    $('#btn-hint').classList.toggle('on', !!(sess && sess.hintOn));
    $('#btn-hint').disabled = !sess || sess.human == null || !!sess.hooks.noHint;
    if (!sess || sess.human == null || !sess.hintOn || sess.hooks.noHint) { box.classList.add('hidden'); return; }
    const st = sess.st;
    const o = NP.getObservation(st, sess.human);
    let h = null;
    try { h = NP.Advisor.hint(o, sess.names); } catch (e) { h = null; }
    if (!h || (st.phase === 'PLAY' && sess.jokerPick)) { box.classList.add('hidden'); return; }
    sess.lastHint = h;
    box.classList.remove('hidden');
    const btn = { bid: T('選ぶ', 'Select'), pass: '', call: T('この札を選ぶ', 'Select This Card'), exchange: T('この3枚を選ぶ', 'Select These 3'), play: T('この札を選ぶ', 'Select This Card') }[h.kind];
    box.innerHTML = `<div class="hb-head"><div class="hb-face">${NP.Art.avatar('mascot')}</div><div class="hb-title">${T('ヒント：', 'Hint: ')}${esc(h.title)}</div></div>
      <div class="hb-body"><div class="hb-text">${esc(h.text)}</div>${h.note ? `<div class="hb-note">${esc(h.note)}</div>` : ''}${btn ? `<button class="hb-do">${btn}</button>` : ''}</div>`;
    const b = $('.hb-do', box);
    if (b) b.onclick = () => {
      S.play('select');
      const a = h.action;
      if (h.kind === 'bid') { sess.bidSuit = a.suit; sess.bidCount = a.count; renderCenter(); }
      else if (h.kind === 'call') { sess.callSel = a.card; renderCenter(); }
      else if (h.kind === 'exchange') { sess.sel = a.discards.slice(); render(); }
      else if (h.kind === 'play') {
        if (sess.hooks.allowCard && !sess.hooks.allowCard(a.card)) return;
        sess.sel = [a.card]; sess.focus = sess.handOrder.indexOf(a.card); renderHand(); renderActions();
      }
    };
  }

  function renderSpectate() {
    const bar = $('#spectate-bar');
    if (!sess || sess.human != null) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = `<span class="sp-tag">${T('観戦中', 'Watching')}</span><button class="small-btn ${sess.revealAll ? 'on' : ''}" id="sp-reveal">${T('全手札を公開：', 'Show all hands: ')}${sess.revealAll ? 'ON' : 'OFF'}</button><button class="small-btn" id="sp-quit">${T('観戦終了', 'Stop Watching')}</button>
      <span class="sp-note">${T('全手札の公開は画面だけ。CPUは自分の見える情報だけで判断しています', 'Showing hands is display-only. Each CPU decides using only what it can see')}</span>`;
    $('#sp-reveal').onclick = () => { sess.revealAll = !sess.revealAll; render(); };
    $('#sp-quit').onclick = () => showTitle();
  }

  // ------------------------------------------------------------------ タイトル・設定・遊び方・戦績
  function showTitle() {
    endSession(true);
    closeModal();
    $('#game').classList.add('hidden');
    const t = $('#title');
    t.classList.remove('hidden');
    const first = !settings.tutorialDone.length && !loadStats().rounds;
    t.innerHTML = `<div class="title-bg"></div><div class="title-veil"></div>
      <div class="title-cards">${['S14', 'JK', 'H12', 'C3'].map((c) => cardHtml(c, { cls: 'deco', trump: 'S', cfg: { yoromeki: true, jokerRequest: true } })).join('')}</div>
      <div class="title-logo"><div class="tl-main">${T('くるくる温泉', 'Kurukuru Onsen')}</div><div class="tl-sub">${T('ナポレオン部', 'Napoleon Club')}</div></div>
      <div class="title-faces">${CHARS.map((id) => `<div class="tf">${NP.Art.avatar(id)}<span>${esc(NP.Art.name(id))}</span></div>`).join('')}</div>
      ${first ? `<div class="title-note">${T('はじめての方は「チュートリアル」がおすすめです', 'New here? Start with the Tutorial')}</div>` : ''}
      <div class="title-main">
        <button class="title-btn tut" data-go="tutorial">${T('チュートリアル', 'Tutorial')}<small>${T('ルールを短く体験', 'Learn the rules quickly')}</small></button>
        <button class="title-btn one" data-go="single">${T('1局遊ぶ', 'Single Round')}<small>${T('配札から10巡まで', 'Deal to the 10th trick')}</small></button>
        <button class="title-btn match" data-go="match">${T('5局マッチ', '5-Round Match')}<small>${T('合計ポイントで順位', 'Ranked by total points')}</small></button>
        <button class="title-btn demo" data-go="demo">${T('観戦', 'Watch')}<small>${T('CPU 5人の対戦', '5 CPUs play')}</small></button>
      </div>
      <div class="title-sub"><button data-go="rules">${T('遊び方', 'How to Play')}</button><button data-go="settings">${T('設定', 'Settings')}</button><button data-go="stats">${T('戦績', 'Stats')}</button></div>
      <div class="lang-switch" role="group" aria-label="Language"><button class="${NP.lang === 'ja' ? 'on' : ''}" data-lang="ja">日本語</button><button class="${NP.lang === 'en' ? 'on' : ''}" data-lang="en">English</button></div>`;
    // 言語の切り替え（タイトル画面だけ。ページを読み直して反映）
    for (const b of $$('[data-lang]', t)) b.onclick = () => { if (b.dataset.lang !== NP.lang) NP.setLang(b.dataset.lang); };
    NP.Art.background($('.title-bg', t));
    for (const b of $$('[data-go]', t)) b.onclick = () => {
      S.ensure(); S.startBgm(); S.play('click');
      const g = b.dataset.go;
      if (g === 'tutorial') NP.Tutorial.menu();
      else if (g === 'single') modeSelect(1);
      else if (g === 'match') modeSelect(5);
      else if (g === 'demo') modeSelect(0);
      else if (g === 'rules') showRules();
      else if (g === 'settings') showSettings();
      else if (g === 'stats') showStats();
    };
  }

  function currentCfgFromSettings() { return {}; } // ルールはぐるぐる温泉準拠のみ
  // 自キャラを席0に、残り4人を席1〜4に
  function charOrder() {
    const me = CHARS.includes(settings.myChar) ? settings.myChar : 'you';
    return [me, ...CHARS.filter((c) => c !== me)];
  }
  function modeSelect(rounds) {
    const demo = rounds === 0;
    const render2 = () => {
      modal(`<div class="m-title">${demo ? T('観戦', 'Watch') : rounds === 5 ? T('5局マッチ', '5-Round Match') : T('1局遊ぶ', 'Single Round')}</div>
        ${demo ? '' : `<div class="ms-sec"><div class="ms-h">${T('あなたのキャラ', 'Your Character')}</div><div class="char-pick">${CHARS.map((id) => `<button class="cp-char ${settings.myChar === id ? 'on' : ''}" data-char="${id}">${NP.Art.avatar(id)}<span>${esc(NP.Art.name(id))}</span></button>`).join('')}</div></div>`}
        <div class="ms-sec"><div class="ms-h">${T('CPUの強さ', 'CPU Difficulty')}</div><div class="ms-row">
          <button class="opt big ${settings.level === 'easy' ? 'on' : ''}" data-level="easy">${T('やさしい', 'Easy')}</button><button class="opt big ${settings.level === 'standard' ? 'on' : ''}" data-level="standard">${T('標準', 'Normal')}</button></div></div>
        ${demo ? '' : `<div class="ms-sec"><div class="ms-h">${T('ヒント', 'Hints')}</div><div class="ms-row"><button class="opt big ${settings.hint ? 'on' : ''}" data-hint="1">ON</button><button class="opt big ${!settings.hint ? 'on' : ''}" data-hint="0">OFF</button></div></div>`}
        <div class="m-buttons"><button class="big-btn white" data-act="back">${T('戻る', 'Back')}</button><button class="big-btn yellow" data-act="start">${demo ? T('観戦を始める', 'Start Watching') : T('開始', 'Start')}</button></div>`, {
        back: () => { closeModal(); },
        start: () => {
          closeModal();
          if (demo) NP.Demo.start({ cfg: currentCfgFromSettings() });
          else startGame({ rounds, cfg: currentCfgFromSettings() });
        },
      }, { wide: true });
      for (const b of $$('[data-level]')) b.onclick = () => { settings.level = b.dataset.level; saveSettings(); S.play('click'); render2(); };
      for (const b of $$('[data-hint]')) b.onclick = () => { settings.hint = b.dataset.hint === '1'; saveSettings(); S.play('click'); render2(); };
      for (const b of $$('[data-char]')) b.onclick = () => { settings.myChar = b.dataset.char; saveSettings(); S.play('select'); render2(); };
    };
    render2();
  }

  function urlSeed() {
    const m = /[?&]seed=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function startGame({ rounds, cfg }) {
    const seed = urlSeed() || String(Date.now());
    startSession({ mode: rounds === 5 ? 'match' : 'single', cfg: { ...cfg, rounds }, seed, human: 0, chars: charOrder(), recordStats: true, onExit: showTitle });
  }

  function showSettings(fromGame) {
    const r = () => {
      const tg = (k, label) => `<div class="set-row"><span>${label}</span><button class="opt ${settings[k] ? 'on' : ''}" data-tg="${k}" data-v="1">ON</button><button class="opt ${!settings[k] ? 'on' : ''}" data-tg="${k}" data-v="0">OFF</button></div>`;
      modal(`<div class="m-title">${T('設定', 'Settings')}</div>
        <div class="set-row"><span>BGM</span><button class="opt ${S.bgmOn ? 'on' : ''}" data-bgm="1">ON</button><button class="opt ${!S.bgmOn ? 'on' : ''}" data-bgm="0">OFF</button></div>
        <div class="set-row"><span>${T('効果音', 'Sound effects')}</span><button class="opt ${S.seOn ? 'on' : ''}" data-se="1">ON</button><button class="opt ${!S.seOn ? 'on' : ''}" data-se="0">OFF</button></div>
        <div class="set-row"><span>${T('演出スピード', 'Animation speed')}</span>${[1, 2, 3].map((v) => `<button class="opt ${settings.speed === v ? 'on' : ''}" data-speed="${v}">×${v}</button>`).join('')}</div>
        ${tg('reduceMotion', T('動きを減らす（揺れ・フラッシュを止める）', 'Reduce motion (no shake or flash)'))}
        ${tg('hint', T('ヒントの初期値', 'Hints on by default'))}
        ${tg('stopEachTrick', T('巡が終わるたびに止める（「次へ」で進む）', 'Pause after each trick (press Next)'))}
        <div class="set-row"><span>${T('戦績', 'Stats')}</span><button class="opt" data-reset="1">${T('戦績を消す', 'Reset stats')}</button></div>
        <div class="m-buttons"><button class="big-btn yellow" data-act="close">${T('閉じる', 'Close')}</button></div>`, { close: () => { closeModal(); if (sess) render(); } });
      for (const b of $$('[data-bgm]')) b.onclick = () => { S.setBgm(b.dataset.bgm === '1'); syncButtons(); r(); };
      for (const b of $$('[data-se]')) b.onclick = () => { S.setSe(b.dataset.se === '1'); syncButtons(); r(); };
      for (const b of $$('[data-speed]')) b.onclick = () => { settings.speed = +b.dataset.speed; saveSettings(); applyVisualSettings(); syncButtons(); r(); };
      for (const b of $$('[data-tg]')) b.onclick = () => { settings[b.dataset.tg] = b.dataset.v === '1'; saveSettings(); applyVisualSettings(); r(); };
      for (const b of $$('[data-reset]')) b.onclick = () => { if (b.dataset.confirm) { store.set('stats', EMPTY_STATS()); toast(T('戦績を消しました', 'Stats reset')); r(); } else { b.dataset.confirm = '1'; b.textContent = T('もう一度押すと消去', 'Press again to reset'); } };
    };
    r();
  }

  function showStats() {
    const s = loadStats();
    const wl = (a) => T(`${a[0]}勝 ${a[1]}敗`, `${a[0]} W - ${a[1]} L`);
    modal(`<div class="m-title">${T('戦績', 'Stats')}</div>
      <p class="m-small">${T('本番の対戦（1局・5局マッチ）で終わった局だけを記録します。チュートリアルと観戦は含みません。', 'Only finished rounds from real games (Single Round / 5-Round Match) are recorded. Tutorials and watching are excluded.')}</p>
      <table class="result-table stats"><tr><th>${T('項目', 'Item')}</th><th>${T('成績', 'Record')}</th></tr>
      <tr><td>${T('遊んだ局', 'Rounds played')}</td><td>${T(`${s.rounds}局（${s.wins}勝）`, `${s.rounds} (${s.wins} won)`)}</td></tr>
      <tr><td>${ROLE_LABEL.napoleon}</td><td>${wl(s.byRole.napoleon)}</td></tr>
      <tr><td>${ROLE_LABEL.adjutant}</td><td>${wl(s.byRole.adjutant)}</td></tr>
      <tr><td>${ROLE_LABEL.allied}</td><td>${wl(s.byRole.allied)}</td></tr>
      <tr><td>${T('単独戦（あなたがナポレオン）', 'Solo games (as Napoleon)')}</td><td>${wl(s.solo)}</td></tr>
      <tr><td>${T('5局マッチ', '5-Round Matches')}</td><td>${T(`${s.matches}回 ・ 1位 ${s.firsts}回${s.matches ? ` ・ 平均 ${(s.rankSum / s.matches).toFixed(1)}位` : ''}`, `${s.matches} played · ${s.firsts} wins${s.matches ? ` · avg. rank ${(s.rankSum / s.matches).toFixed(1)}` : ''}`)}</td></tr></table>
      <div class="m-buttons"><button class="big-btn yellow" data-act="close">${T('閉じる', 'Close')}</button></div>`, { close: closeModal }, { wide: true });
  }

  const RULE_TABS_EN = {
    flow: ['Flow', `<ol class="rules-list">
      <li><b>Deal</b>: 53 cards (with one Joker), 10 to each of 5 players. The last 3 are the face-down <b>kitty</b>.</li>
      <li><b>Bidding</b>: bid a suit and a number, starting at 10 (e.g. ♥10). Higher number wins; ties go ♠ &gt; ♥ &gt; ♦ &gt; ♣. When the other four pass in a row, the bid is final. That suit is <b>trump</b> and the bidder is <b>Napoleon</b>. If everyone passes, redeal.</li>
      <li><b>Calling the adjutant</b>: Napoleon names one card. Whoever holds it is the <b>adjutant</b> (a secret partner) and stays hidden until playing it. If Napoleon holds it or it is in the kitty, Napoleon plays solo, 1 vs 4.</li>
      <li><b>Exchange</b>: Napoleon takes the kitty and discards 3. Discarded point cards are shown face up and go to the <b>winner of the first trick</b>.</li>
      <li><b>Play (10 tricks)</b>: Napoleon leads first. You must follow the lead suit if you can (the Joker is an exception). The player who plays the strongest card takes all five cards and leads the next trick.</li>
      <li><b>Result</b>: if Napoleon + adjutant take at least the bid number of <b>point cards</b> (A, K, Q, J, 10), Napoleon's army wins.</li></ol>`],
    power: ['Card Strength', `<p>Strongest first (once one applies, the rest are ignored):</p><ol class="rules-list">
      <li>Swoon: if ♠A and ♥Q are in the same trick, the ♥Q wins</li>
      <li><b>Mighty</b> (♠A)</li>
      <li><b>Joker</b> (same strength whether led or played later)</li>
      <li><b>Right Jack</b> (the Jack of trump)</li>
      <li><b>Left Jack</b> (the other Jack of the same color: ♠↔♣, ♥↔♦)</li>
      <li>Same Two: when all five cards are one suit, that suit's 2 (from the 2nd trick)</li>
      <li>The highest trump (A &gt; K &gt; ... &gt; 2)</li>
      <li>The highest card of the lead suit</li></ol>
      <p class="m-small">Other suits never win. The Mighty and both Jacks still follow the suit printed on them (the Left Jack keeps its own suit).</p>`],
    special: ['Special Rules', `<ul class="rules-list">
      <li><b>Joker</b>: may be played any time. When you lead it, name one suit the others must play.</li>
      <li><b>Joker Call</b>: if the lead is ♣3, whoever holds the Joker must play it, even with clubs in hand (normal strength).</li>
      <li><b>Swoon</b>: if ♠A and ♥Q appear in the same trick, the ♥Q wins.</li>
      <li><b>Same Two</b>: if all five cards are the same suit (no Joker), that suit's 2 wins. It still loses to the Mighty and both Jacks. Not in the first trick.</li>
      <li><b>Discarded point cards</b>: shown face up and taken by the winner of the first trick.</li></ul>`],
    score: ['Scoring', `<table class="result-table"><tr><th>Outcome</th><th>Napoleon</th><th>Adjutant</th><th>Each Ally</th></tr>
      <tr><td>Napoleon's army wins</td><td>+4</td><td>+2</td><td>0</td></tr><tr><td>Allies win</td><td>0</td><td>0</td><td>+2</td></tr>
      <tr><td>Napoleon wins (solo)</td><td>+6</td><td>—</td><td>0</td></tr><tr><td>Napoleon's army wins (all 20 point cards)</td><td>+6</td><td>+4</td><td>0</td></tr>
      <tr><td>Napoleon wins (solo, all 20 point cards)</td><td>+10</td><td>—</td><td>0</td></tr><tr><td>Allies win (vs. solo)</td><td>0</td><td>—</td><td>+1</td></tr></table>
      <p class="m-small">Only one row applies per round. Point cards (out of 20) and match points are different things.</p>`],
    words: ['Terms', `<ul class="rules-list"><li><b>Point cards</b>: the A, K, Q, J and 10 of each suit (20 in all). Your goal is to collect point cards, regardless of their rank.</li>
      <li><b>Suit</b>: ♠♥♦♣. <b>Trump</b>: the suit Napoleon chose. <b>Lead</b>: the first card of a trick.</li>
      <li><b>Trick</b>: a single contest in which each player plays one card. The winner takes all five cards.</li>
      <li><b>Round</b>: one deal, consisting of bidding, the exchange, and 10 tricks.</li>
      <li><b>Napoleon's army</b>: Napoleon + the adjutant. <b>Allies</b>: the other three (four in a solo game).</li></ul>`],
  };
  const RULE_TABS = en ? RULE_TABS_EN : {
    flow: ['流れ', `<ol class="rules-list">
      <li><b>配る</b>：53枚（ジョーカー1枚入り）を5人に10枚ずつ。残り3枚は伏せた<b>交換札</b>。</li>
      <li><b>競り</b>：「マーク＋枚数」で10枚から立候補（例：♥10）。強さは枚数、同じ枚数なら ♠＞♥＞♦＞♣。ほかの4人が続けてパスしたら決定。宣言したマークが<b>切札</b>、宣言者が<b>ナポレオン</b>。全員パスなら配り直し。</li>
      <li><b>副官の指定</b>：ナポレオンが札を1枚指定。その札を持つ人が<b>副官</b>（秘密の味方）。副官はその札を出すまで正体を明かしません。自分の札や交換札の中なら1対4の単独戦。</li>
      <li><b>交換</b>：ナポレオンは交換札3枚を加え、3枚捨てる。得点札を捨てると表向きで公開され、<b>最初の巡の勝者</b>が取ります。</li>
      <li><b>札を出す（10巡）</b>：最初はナポレオンが先手。台札と同じマークを持っていれば必ず出す（ジョーカーは例外）。一番強い札の人が5枚を取り、次の先手になります。</li>
      <li><b>決着</b>：ナポレオン＋副官が取った<b>得点札</b>（A・K・Q・J・10）が宣言枚数以上ならナポレオン軍の勝ち。</li></ol>`],
    power: ['札の強さ', `<p>強い順（上で決まったら下は見ません）：</p><ol class="rules-list">
      <li>よろめき：♠Aと♥Qが同じ巡に出たら♥Qの勝ち</li>
      <li><b>マイティ</b>（♠A）</li>
      <li><b>ジョーカー</b>（先手でも後から出しても同じ強さ）</li>
      <li><b>正ジャック</b>（切札のJ）</li>
      <li><b>裏ジャック</b>（切札と同じ色のもう一方のJ：♠↔♣、♥↔♦）</li>
      <li>セイム2：5枚とも同じマークのとき、そのマークの2（2巡目から）</li>
      <li>切札のいちばん大きい数（A＞K＞…＞2）</li>
      <li>台札（先手のマーク）のいちばん大きい数</li></ol>
      <p class="m-small">ほかのマークの札は勝ちません。マイティ・正J・裏Jも、出せるかどうかは印刷されたマークで決まります（裏Jは元のマーク）。</p>`],
    special: ['特殊ルール', `<ul class="rules-list">
      <li><b>ジョーカー</b>：いつでも出せます。先手で出したら、ほかの人に出させるマークを1つ指定します。</li>
      <li><b>ジョーカー請求</b>：先手が♣3を出したら、ジョーカーを持っている人は♣があっても必ずジョーカーを出します（強さは通常どおり）。</li>
      <li><b>よろめき</b>：♠Aと♥Qが同じ巡に出たら、♥Qが勝ちます。</li>
      <li><b>セイム2</b>：5枚すべてが同じマーク（ジョーカーなし）なら、そのマークの2が勝ちます。マイティ・正J・裏Jには負けます。最初の巡は無効。</li>
      <li><b>捨てた得点札</b>：表向きで公開され、最初の巡の勝者が取ります。</li></ul>`],
    score: ['得点表', `<table class="result-table"><tr><th>条件</th><th>ナポレオン</th><th>副官</th><th>連合軍の各人</th></tr>
      <tr><td>ナポレオン軍勝利</td><td>+4</td><td>+2</td><td>0</td></tr><tr><td>連合軍勝利</td><td>0</td><td>0</td><td>+2</td></tr>
      <tr><td>ナポレオン軍勝利（副官なし）</td><td>+6</td><td>—</td><td>0</td></tr><tr><td>ナポレオン軍勝利（20枚獲得）</td><td>+6</td><td>+4</td><td>0</td></tr>
      <tr><td>ナポレオン軍勝利（副官なし・20枚）</td><td>+10</td><td>—</td><td>0</td></tr><tr><td>連合軍勝利（副官なし）</td><td>0</td><td>—</td><td>+1</td></tr></table>
      <p class="m-small">1局に当てはまる1行だけを加算します。得点札の枚数（20枚中）と、マッチのポイントは別物です。</p>`],
    words: ['用語', `<ul class="rules-list"><li><b>得点札</b>：各マークのA・K・Q・J・10（全20枚）。数字の大きさではなく、この枚数を集めます。</li>
      <li><b>マーク</b>：♠♥♦♣（スート）。<b>切札</b>：ナポレオンが決めたマーク。<b>台札</b>：その巡の先手の札。</li>
      <li><b>ひと勝負（トリック）</b>：全員が1枚ずつ出す1回。画面では「1巡目」などと表示します。</li>
      <li><b>ナポレオン軍</b>：ナポレオン＋副官。<b>連合軍</b>：残りの3人（単独戦なら4人）。</li></ul>`],
  };
  function showRules(tab = 'flow') {
    modal(`<div class="m-title">${T('遊び方', 'How to Play')}</div><div class="tabs">${Object.entries(RULE_TABS).map(([k, v]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${v[0]}</button>`).join('')}</div>
      <div class="rules-note">${T('ルールはぐるぐる温泉準拠', 'Rules follow Guruguru Onsen')}</div><div class="rules-body">${RULE_TABS[tab][1]}</div><div class="m-buttons"><button class="big-btn yellow" data-act="close">${T('閉じる', 'Close')}</button></div>`, { close: closeModal }, { wide: true });
    for (const b of $$('[data-tab]')) b.onclick = () => { S.play('click'); showRules(b.dataset.tab); };
  }

  function showMenu() {
    if (!sess) return;
    const tut = sess.mode === 'tutorial';
    modal(`<div class="m-title">${T('メニュー', 'Menu')}</div><div class="m-buttons col">
      <button class="big-btn white" data-act="review">${T('巡の振り返り', 'Trick Review')}</button>
      <button class="big-btn white" data-act="settings">${T('設定', 'Settings')}</button>
      <button class="big-btn white" data-act="rules">${T('遊び方', 'How to Play')}</button>
      <button class="big-btn white" data-act="title">${tut ? T('チュートリアルを中断', 'Quit Tutorial') : sess.human == null ? T('観戦終了', 'Stop Watching') : T('タイトルへ戻る（この局は記録されません）', 'Back to Title (this round is not recorded)')}</button>
      <button class="big-btn yellow" data-act="close">${T('続ける', 'Continue')}</button></div>`, {
      review: () => showReview(), settings: () => showSettings(true), rules: () => showRules(), close: closeModal,
      title: () => { closeModal(); showTitle(); },
    });
  }

  function syncButtons() {
    $('#btn-bgm').classList.toggle('off', !S.bgmOn);
    $('#btn-se').classList.toggle('off', !S.seOn);
    $('#btn-speed').textContent = '×' + settings.speed;
  }

  // ------------------------------------------------------------------ 入力
  function bind() {
    $('#btn-hint').onclick = () => { if (!sess) return; sess.hintOn = !sess.hintOn; S.play('click'); renderHint(); };
    $('#btn-bgm').onclick = () => { S.setBgm(!S.bgmOn); syncButtons(); };
    $('#btn-se').onclick = () => { S.setSe(!S.seOn); syncButtons(); S.play('click'); };
    $('#btn-speed').onclick = () => { settings.speed = settings.speed % 3 + 1; saveSettings(); applyVisualSettings(); syncButtons(); S.play('click'); };
    $('#btn-help').onclick = () => { S.play('click'); showRules(); };
    $('#btn-menu').onclick = () => { S.play('click'); showMenu(); };
    $('#btn-last').onclick = () => { S.play('click'); showLastTrick(); };
    $('#btn-log').onclick = () => { const p = $('#log-panel'); p.classList.toggle('hidden'); if (!p.classList.contains('hidden') && sess) renderLog(); S.play('click'); };
    $('.log-close').onclick = () => $('#log-panel').classList.add('hidden');
    $('#trick-banner').onclick = () => { if (canManualCollect()) collectNow(); };
    $('#rot-help').onclick = () => showRules();
    $('#rot-settings').onclick = () => showSettings();
    document.addEventListener('pointerdown', () => { S.ensure(); S.startBgm(); }, { once: true });
    document.addEventListener('keydown', (e) => {
      if (!sess || $('#game').classList.contains('hidden')) return;
      if (modalOpen()) { if (e.key === 'Escape') { const b = $('#modal-layer [data-act="close"]'); if (b) b.click(); } return; }
      const st = sess.st, me = sess.human;
      if (e.key === 'h' || e.key === 'H') { $('#btn-hint').click(); return; }
      if (e.key === 'l' || e.key === 'L') { $('#btn-log').click(); return; }
      if (me == null) return;
      const hand = sess.handOrder || [];
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!hand.length) return;
        sess.focus = (sess.focus + (e.key === 'ArrowRight' ? 1 : -1) + hand.length) % hand.length;
        if (st.phase === 'PLAY' && st.turn === me) {
          const c = hand[sess.focus];
          const legal = myLegalCards();
          if (legal.includes(c) && (!sess.hooks.allowCard || sess.hooks.allowCard(c))) sess.sel = [c];
        }
        renderHand(); renderActions(); e.preventDefault();
      } else if (e.key === 'ArrowUp' || e.key === ' ') {
        if (st.phase === 'EXCHANGE' && hand[sess.focus]) { onCardClick(hand[sess.focus]); e.preventDefault(); }
      } else if (e.key === 'Enter') {
        if (canManualCollect() && settings.stopEachTrick) collectNow();
        else if (st.phase === 'PLAY' || st.phase === 'EXCHANGE') confirmPlay();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        if (sess.jokerPick) sess.jokerPick = false;
        sess.sel = []; render();
      }
    });
    window.addEventListener('resize', fit);
    // 差し替え画像が後から読み込まれたら描き直す
    window.addEventListener('np:art', () => {
      if (sess) { render(); return; }
      const f = $('#title .title-faces');
      if (f && !$('#title').classList.contains('hidden')) f.innerHTML = CHARS.map((id) => `<div class="tf">${NP.Art.avatar(id)}<span>${esc(NP.Art.name(id))}</span></div>`).join('');
      const cp = $('.char-pick');
      if (cp) for (const b of $$('.cp-char', cp)) { const sp = b.querySelector('span').outerHTML; b.innerHTML = NP.Art.avatar(b.dataset.char) + sp; }
    });
  }

  NP.UI = {
    get sess() { return sess; }, settings, saveSettings, store, startSession, endSession, act, step, render, later, toast, say, modal, closeModal,
    showTitle, showRules, showSettings, startGame, charOrder, cardHtml, cardName, cardNameHtml, symHtml, esc, collectNow, addLog, CHARS, renderHint,
  };

  function applyStaticText() {
    document.title = T('くるくる温泉ナポレオン部', 'Kurukuru Onsen Napoleon Club');
    const set = (sel, text) => { const e = $(sel); if (e) e.textContent = text; };
    const tip = (sel, text) => { const e = $(sel); if (e) e.title = text; };
    $('#btn-hint').childNodes[0].nodeValue = T('ヒント', 'Hint');
    set('#btn-log', T('ログ', 'Log'));
    tip('#btn-hint', T('ヒント（H）', 'Hint (H)')); tip('#btn-bgm', 'BGM'); tip('#btn-se', T('効果音', 'Sound effects'));
    tip('#btn-speed', T('演出スピード', 'Animation speed')); tip('#btn-log', T('公開ログ（L）', 'Public log (L)')); tip('#btn-help', T('遊び方', 'How to play')); tip('#btn-menu', T('メニュー', 'Menu'));
    set('#btn-last', T('直前の札', 'Last trick'));
    $('#log-panel .log-head').childNodes[0].nodeValue = T('公開ログ', 'Public Log');
    set('#coach .coach-title', T('チュートリアル', 'Tutorial'));
    set('#coach .coach-quit', T('中断', 'Quit'));
    set('#coach .coach-next', T('つぎへ ▶', 'Next ▶'));
    set('#rotate-note p', T('横向きにすると遊べます', 'Rotate your device to landscape to play'));
    set('#rot-help', T('遊び方', 'How to play'));
    set('#rot-settings', T('設定', 'Settings'));
  }

  window.addEventListener('DOMContentLoaded', () => {
    applyStaticText();
    applyVisualSettings();
    NP.Art.background($('#game .bg-deco'));
    fit();
    bind();
    syncButtons();
    showTitle();
    if (/[?&]demo/.test(location.search)) NP.Demo.start({ cfg: { preset: 'standard' } });
  });
})();
