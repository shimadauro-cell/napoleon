// ナポレオンのルールエンジン。DOM・タイマー・音・保存に依存しない（ブラウザと Node の両方で動く）。
// 仕様: NAPOLEON_SPEC.md v0.3（温泉準拠・記事ベース）
'use strict';
(function (root) {
  const NP = (root.NP = root.NP || {});
  const L = NP.L || ((ja) => ja); // 言語（i18n.js が無い Node のテストでは日本語）
  const poss = (who) => L(who + 'の', who === 'You' ? 'Your ' : who + "'s "); // 「〇〇の」（文頭）
  const possMid = (who) => L(who + 'の', who === 'You' ? 'your ' : who + "'s "); // 文の途中

  // ------------------------------------------------------------------ 乱数（シード付き・ストリーム独立）
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  class Rng {
    constructor(seed) { this.s = (hashStr(seed) || 1) >>> 0; }
    next() { // mulberry32
      let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  }
  // 判断用の乱数。観測情報から作った key だけで決まる（演出や非公開情報で変わらない）
  const rngFor = (...parts) => new Rng(parts.join('|'));

  // ------------------------------------------------------------------ カード
  const SUITS = ['S', 'H', 'D', 'C']; // 強い順（競りの同枚数比較）
  const SUIT_RANK = { S: 4, H: 3, D: 2, C: 1 };
  const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const SUIT_NAME = { S: L('スペード', 'Spades'), H: L('ハート', 'Hearts'), D: L('ダイヤ', 'Diamonds'), C: L('クラブ', 'Clubs') };
  const RED = { H: true, D: true };
  const LEFT_SUIT = { S: 'C', C: 'S', H: 'D', D: 'H' }; // 裏ジャックのマーク
  const RANK_LABEL = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J' };
  const JOKER = 'JK';

  const Cards = {
    JOKER, SUITS, SUIT_SYM, SUIT_NAME, LEFT_SUIT,
    make: (suit, rank) => suit + rank,
    suit: (c) => (c === JOKER ? null : c[0]),
    rank: (c) => (c === JOKER ? 0 : parseInt(c.slice(1), 10)),
    isJoker: (c) => c === JOKER,
    isPoint: (c) => c !== JOKER && parseInt(c.slice(1), 10) >= 10,
    isRed: (c) => c !== JOKER && !!RED[c[0]],
    rankLabel: (r) => RANK_LABEL[r] || String(r),
    label(c) { return c === JOKER ? L('ジョーカー', 'Joker') : SUIT_SYM[c[0]] + Cards.rankLabel(Cards.rank(c)); },
    deck() {
      const d = [];
      for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(s + r);
      d.push(JOKER);
      return d;
    },
    // 局の切札に応じた呼び名（無ければ空）
    roleName(c, trump, cfg) {
      if (c === 'S14') return L('マイティ', 'Mighty');
      if (c === JOKER) return L('ジョーカー', 'Joker');
      if (trump && c === trump + '11') return L('正ジャック', 'Right Jack');
      if (trump && c === LEFT_SUIT[trump] + '11') return L('裏ジャック', 'Left Jack');
      if (c === 'H12' && (!cfg || cfg.yoromeki)) return L('よろめき', 'Swoon');
      if (c === 'C3' && (!cfg || cfg.jokerRequest)) return L('ジョーカー請求', 'Joker Call');
      return '';
    },
    // 表示用の並び（切札→♠♥♦♣、強い順）
    sortHand(hand, trump) {
      const order = (c) => {
        if (c === JOKER) return -1000;
        if (c === 'S14') return -2000;
        const s = Cards.suit(c);
        const sk = s === trump ? -1 : SUITS.indexOf(s);
        return sk * 100 - Cards.rank(c);
      };
      return hand.slice().sort((a, b) => order(a) - order(b));
    },
  };

  // ------------------------------------------------------------------ 設定
  // ルールは「ぐるぐる温泉準拠」のみ（簡略ルール・カスタム設定はなし）
  const RULES = { minBid: 13, yoromeki: true, same2: 'second', jokerRequest: true };
  const RULE_NAME = L('ぐるぐる温泉準拠', 'Guruguru Onsen rules');
  function normalizeConfig(cfg = {}) {
    return { ...RULES, ruleName: RULE_NAME, rounds: cfg.rounds === 5 ? 5 : 1 };
  }
  // ------------------------------------------------------------------ 合法手（強さとは別の関数）
  // trick: [{seat, card}], ctx: { requestedSuit, jokerRequest }
  function followSuitOf(trick, requestedSuit) {
    if (!trick.length) return null;
    const lead = trick[0].card;
    return lead === JOKER ? requestedSuit : Cards.suit(lead);
  }
  function isJokerRequest(trick, cfg) {
    return !!(cfg.jokerRequest && trick.length && trick[0].card === 'C3');
  }
  // 返り値: { cards: [...], reason: { card: 説明 } }
  function legalPlays(hand, trick, requestedSuit, cfg) {
    if (!trick.length) return hand.slice();
    if (isJokerRequest(trick, cfg) && hand.includes(JOKER)) return [JOKER];
    const fs = followSuitOf(trick, requestedSuit);
    const same = hand.filter((c) => c !== JOKER && Cards.suit(c) === fs);
    if (!same.length) return hand.slice();
    return hand.includes(JOKER) ? [...same, JOKER] : same;
  }
  // 出せない理由（UI用）。出せる札なら null
  function illegalReason(card, hand, trick, requestedSuit, cfg) {
    const legal = legalPlays(hand, trick, requestedSuit, cfg);
    if (legal.includes(card)) return null;
    if (isJokerRequest(trick, cfg) && hand.includes(JOKER)) return L('先手が♣3の「ジョーカー請求」です。ジョーカーを持っている人は必ずジョーカーを出します。', 'The lead is ♣3 — a Joker Call. Whoever holds the Joker must play it.');
    const fs = followSuitOf(trick, requestedSuit);
    const sym = SUIT_SYM[fs];
    const why = trick[0].card === JOKER ? L(`先手のジョーカーが${sym}を指定したので`, `The leading Joker called ${sym}`) : L(`先手が${sym}なので`, `The lead is ${sym}`);
    let extra = '';
    if (card === 'S14') extra = L('（マイティも♠の札として扱います）', ' (the Mighty counts as a ♠ card)');
    else if (Cards.rank(card) === 11) extra = L('（ジャックは印刷されたマークで扱います）', ' (Jacks follow the suit printed on them)');
    return L(`${why}、${sym}を持っている間は${sym}を出します。${extra}`, `${why}, so you must play ${sym} while you have any.${extra}`);
  }

  // ------------------------------------------------------------------ 勝者判定（途中の札でも暫定判定できる）
  // cards: [{seat, card}] 出した順, ctx: { trump, requestedSuit, trickNo(0始まり), cfg }
  const REASONS = {
    YOROMEKI: L('よろめき（♥Qが♠Aに勝つ）', 'Swoon (♥Q beats ♠A)'),
    MIGHTY: L('マイティ（♠A）', 'Mighty (♠A)'),
    JOKER: L('ジョーカー', 'Joker'),
    RIGHT_JACK: L('正ジャック', 'Right Jack'),
    LEFT_JACK: L('裏ジャック', 'Left Jack'),
    SAME_TWO: L('セイム2', 'Same Two'),
    TRUMP: L('切札', 'Trump'),
    LEAD_SUIT: L('台札のマーク', 'Lead suit'),
  };
  function same2Active(ctx) {
    const m = ctx.cfg.same2;
    if (m === 'off') return false;
    if (m === 'second') return ctx.trickNo >= 1;
    return true;
  }
  function resolveTrick(cards, ctx) {
    const { trump, cfg } = ctx;
    const has = (id) => cards.find((x) => x.card === id);
    const pointCardCount = cards.filter((x) => Cards.isPoint(x.card)).length;
    const done = (x, reasonCode) => ({ winnerSeat: x.seat, winnerCard: x.card, reasonCode, pointCardCount });
    if (!cards.length) return null;
    if (cfg.yoromeki && has('S14') && has('H12')) return done(has('H12'), 'YOROMEKI');
    if (has('S14')) return done(has('S14'), 'MIGHTY');
    if (has(JOKER)) return done(has(JOKER), 'JOKER');
    if (trump && has(trump + '11')) return done(has(trump + '11'), 'RIGHT_JACK');
    if (trump && has(LEFT_SUIT[trump] + '11')) return done(has(LEFT_SUIT[trump] + '11'), 'LEFT_JACK');
    if (cards.length === 5 && same2Active(ctx)) {
      const s = Cards.suit(cards[0].card);
      if (cards.every((x) => x.card !== JOKER && Cards.suit(x.card) === s) && has(s + '2')) return done(has(s + '2'), 'SAME_TWO');
    }
    const best = (list) => list.reduce((a, b) => (Cards.rank(b.card) > Cards.rank(a.card) ? b : a));
    const trumps = cards.filter((x) => x.card !== JOKER && Cards.suit(x.card) === trump);
    if (trumps.length) return done(best(trumps), 'TRUMP');
    const ls = cards[0].card === JOKER ? ctx.requestedSuit : Cards.suit(cards[0].card);
    const leads = cards.filter((x) => x.card !== JOKER && Cards.suit(x.card) === ls);
    return done(best(leads), 'LEAD_SUIT');
  }
  // 勝因の説明文（UI・ヒント共通）
  function explainWin(res, names, trump) {
    const who = names[res.winnerSeat];
    const card = Cards.label(res.winnerCard);
    switch (res.reasonCode) {
      case 'YOROMEKI': return L(`${who}の♥Qが「よろめき」で♠Aに勝ちました`, `${poss(who)}♥Q beat the ♠A — Swoon!`);
      case 'MIGHTY': return L(`${who}の♠A（マイティ）がいちばん強い札でした`, `${poss(who)}♠A (Mighty) was the strongest card`);
      case 'JOKER': return L(`${who}のジョーカーが勝ちました（♠Aの次に強い）`, `${poss(who)}Joker won (second only to ♠A)`);
      case 'RIGHT_JACK': return L(`${who}の${card}（正ジャック＝切札のJ）が勝ちました`, `${poss(who)}${card} won (Right Jack = the trump Jack)`);
      case 'LEFT_JACK': return L(`${who}の${card}（裏ジャック＝切札と同色のJ）が勝ちました`, `${poss(who)}${card} won (Left Jack = the other Jack of the trump's color)`);
      case 'SAME_TWO': return L(`5枚が同じマークだったので、${who}の${card}が「セイム2」で勝ちました`, `All five cards were the same suit, so ${possMid(who)}${card} won — Same Two!`);
      case 'TRUMP': return L(`${who}の${card}が切札${SUIT_SYM[trump]}の中でいちばん強い札でした`, `${poss(who)}${card} was the highest trump (${SUIT_SYM[trump]})`);
      case 'LEAD_SUIT': return L(`切札が出ず、台札のマークでいちばん強い${who}の${card}が勝ちました`, `No trump was played, so ${possMid(who)}${card}, the highest of the lead suit, won`);
    }
    return '';
  }

  // ------------------------------------------------------------------ 競り
  const bidStrength = (b) => b.count * 10 + SUIT_RANK[b.suit];
  const nextSeat = (s) => (s + 1) % 5;

  // ------------------------------------------------------------------ 得点表（記事の得点表・確定）
  function scoreRound(r) {
    const pts = [0, 0, 0, 0, 0];
    const allied = [0, 1, 2, 3, 4].filter((s) => s !== r.napoleon && s !== r.adjutant);
    let row;
    if (r.success) {
      if (r.solo && r.napCount === 20) { row = 'SOLO_20'; pts[r.napoleon] += 10; }
      else if (!r.solo && r.napCount === 20) { row = 'TEAM_20'; pts[r.napoleon] += 6; pts[r.adjutant] += 4; }
      else if (r.solo) { row = 'SOLO_WIN'; pts[r.napoleon] += 6; }
      else { row = 'TEAM_WIN'; pts[r.napoleon] += 4; pts[r.adjutant] += 2; }
    } else if (r.solo) { row = 'SOLO_LOSE'; for (const s of allied) pts[s] += 1; }
    else { row = 'TEAM_LOSE'; for (const s of allied) pts[s] += 2; }
    return { row, pts };
  }
  const SCORE_ROWS = {
    TEAM_WIN: L('ナポレオン軍勝利', "Napoleon's army wins"),
    TEAM_LOSE: L('連合軍勝利', 'Allies win'),
    SOLO_WIN: L('ナポレオン軍勝利（副官なし）', 'Napoleon wins (solo)'),
    TEAM_20: L('ナポレオン軍勝利（20枚獲得）', "Napoleon's army wins (all 20 point cards)"),
    SOLO_20: L('ナポレオン軍勝利（副官なし・20枚）', 'Napoleon wins (solo, all 20 point cards)'),
    SOLO_LOSE: L('連合軍勝利（副官なし）', 'Allies win (vs. solo)'),
  };

  // ------------------------------------------------------------------ ゲーム状態
  function createGame(config, seed) {
    const cfg = normalizeConfig(config);
    seed = seed == null ? String(Date.now()) : String(seed);
    const setupRng = new Rng(seed + '|setup');
    const st = {
      cfg, seed,
      dealRng: new Rng(seed + '|deal'),
      roundNo: 0, // 完了した局数＋1が現在の局（DEAL時に増える）
      dealCount: 0,
      dealer: setupRng.int(5),
      bidStart: setupRng.int(5), // 初局の競り開始席（補完）
      lastNapoleon: null,
      scores: [0, 0, 0, 0, 0],
      roundResults: [],
      phase: 'DEAL',
      actionId: 0,
      log: [],
    };
    deal(st);
    return st;
  }

  function freshRound(st) {
    Object.assign(st, {
      hands: [[], [], [], [], []], kitty: [],
      bids: [], currentBid: null, passStreak: 0, turn: null,
      napoleon: null, trump: null, target: null,
      calledCard: null, adjutant: null, solo: false, soloReason: null,
      adjutantRevealed: false, soloRevealed: false, revealTrick: null,
      napoleonKnowsSolo: false,
      discards: [], discardsCollected: false,
      trickNo: 0, leader: null, trick: [], requestedSuit: null,
      tricks: [], wonCards: [[], [], [], [], []], lastTrick: null,
      result: null,
    });
  }

  function deal(st) {
    freshRound(st);
    st.dealCount++;
    const deck = st.dealRng.shuffle(Cards.deck());
    let seat = nextSeat(st.dealer);
    for (let i = 0; i < 50; i++) { st.hands[seat].push(deck[i]); seat = nextSeat(seat); }
    st.kitty = deck.slice(50);
    st.phase = 'BIDDING';
    st.turn = st.lastNapoleon != null ? st.lastNapoleon : st.bidStart;
    st.bidStart = st.turn;
    st.log.push({ t: 'deal', dealer: st.dealer, start: st.turn });
  }

  // シナリオ（チュートリアル・テスト用）: 通常エンジンの状態を固定札で作る
  function createScenario(config, s) {
    const st = createGame(config, s.seed || 'scenario');
    freshRound(st);
    st.hands = s.hands.map((h) => h.slice());
    st.kitty = (s.kitty || []).slice();
    if (s.phase === 'BIDDING') { st.roundNo = 0; st.phase = 'BIDDING'; st.turn = s.turn || 0; return st; }
    st.roundNo = 1;
    st.napoleon = s.napoleon; st.trump = s.trump; st.target = s.target || 13;
    st.currentBid = { seat: s.napoleon, suit: s.trump, count: st.target };
    st.bids = [{ seat: s.napoleon, suit: s.trump, count: st.target }];
    if (s.phase === 'CALL_ADJUTANT') { st.phase = 'CALL_ADJUTANT'; st.turn = s.napoleon; return st; }
    // 副官指定・交換済みの状態から
    setCalled(st, s.calledCard);
    st.discards = (s.discards || []).slice();
    st.napoleonKnowsSolo = st.solo;
    if (st.solo && st.soloReason === 'discard' && Cards.isPoint(st.calledCard)) st.soloRevealed = true;
    st.phase = 'PLAY';
    st.trickNo = s.trickNo || 0;
    st.leader = s.leader != null ? s.leader : s.napoleon;
    st.turn = st.leader;
    st.discardsCollected = st.trickNo > 0;
    if (s.wonCards) st.wonCards = s.wonCards.map((w) => w.slice());
    return st;
  }

  function setCalled(st, card) {
    st.calledCard = card;
    const holder = [0, 1, 2, 3, 4].find((s) => st.hands[s].includes(card));
    if (holder != null && holder !== st.napoleon) { st.adjutant = holder; st.solo = false; st.soloReason = null; }
    else {
      st.adjutant = null; st.solo = true;
      st.soloReason = holder === st.napoleon ? 'self' : st.kitty.includes(card) ? 'kitty' : 'discard';
    }
  }

  function err(msg) { return { ok: false, error: msg, events: [] }; }

  // 各席の合法アクション
  function getLegalActions(st, seat) {
    switch (st.phase) {
      case 'BIDDING': {
        if (st.turn !== seat) return [];
        const acts = [{ type: 'pass', seat }];
        for (let n = st.cfg.minBid; n <= 20; n++) for (const s of SUITS) {
          const b = { seat, suit: s, count: n };
          if (!st.currentBid || bidStrength(b) > bidStrength(st.currentBid)) acts.push({ type: 'bid', ...b });
        }
        return acts;
      }
      case 'CALL_ADJUTANT':
        return seat === st.napoleon ? Cards.deck().map((c) => ({ type: 'call', seat, card: c })) : [];
      case 'EXCHANGE':
        return seat === st.napoleon ? [{ type: 'exchange', seat, choose: 3, from: st.hands[seat].slice() }] : [];
      case 'PLAY': {
        if (st.turn !== seat) return [];
        const legal = legalPlays(st.hands[seat], st.trick, st.requestedSuit, st.cfg);
        const acts = [];
        for (const c of legal) {
          if (c === JOKER && !st.trick.length) for (const s of SUITS) acts.push({ type: 'play', seat, card: c, requestedSuit: s });
          else acts.push({ type: 'play', seat, card: c });
        }
        return acts;
      }
      default: return [];
    }
  }

  function applyAction(st, a) {
    if (!a || typeof a !== 'object') return err(L('不正なアクション', 'Invalid action'));
    if (a.actionId != null && a.actionId !== st.actionId) return err(L('古い操作です', 'That action is out of date'));
    const ev = [];
    const ok = () => { st.actionId++; return { ok: true, events: ev }; };
    switch (a.type) {
      case 'bid':
      case 'pass': {
        if (st.phase !== 'BIDDING') return err(L('競りの時間ではありません', 'It is not the bidding phase'));
        if (a.seat !== st.turn) return err(L('手番ではありません', 'It is not your turn'));
        if (a.type === 'bid') {
          const b = { seat: a.seat, suit: a.suit, count: a.count };
          if (!SUITS.includes(b.suit) || !Number.isInteger(b.count) || b.count < st.cfg.minBid || b.count > 20) return err(L('宣言できない枚数です', 'You cannot bid that number'));
          if (st.currentBid && bidStrength(b) <= bidStrength(st.currentBid)) return err(L('今の宣言より強い宣言が必要です', 'Your bid must beat the current bid'));
          st.currentBid = b; st.passStreak = 0;
          st.bids.push({ ...b });
          ev.push({ t: 'bid', ...b });
          if (b.count === 20 && b.suit === 'S') { finishBidding(st, ev); return ok(); }
        } else {
          st.passStreak++;
          st.bids.push({ seat: a.seat, pass: true });
          ev.push({ t: 'pass', seat: a.seat });
          if (!st.currentBid && st.passStreak >= 5) {
            st.phase = 'REDEAL_WAIT'; st.turn = null;
            ev.push({ t: 'allPass' });
            return ok();
          }
          if (st.currentBid && st.passStreak >= 4) { finishBidding(st, ev); return ok(); }
        }
        let n = nextSeat(st.turn);
        if (st.currentBid && n === st.currentBid.seat) n = nextSeat(n);
        st.turn = n;
        return ok();
      }
      case 'redeal': {
        if (st.phase !== 'REDEAL_WAIT') return err(L('配り直しの時間ではありません', 'It is not time to redeal'));
        st.dealer = nextSeat(st.dealer); // 競りの開始席は維持（deal が前局ナポレオン or bidStart から始める）
        deal(st);
        ev.push({ t: 'redeal' });
        return ok();
      }
      case 'call': {
        if (st.phase !== 'CALL_ADJUTANT') return err(L('副官指定の時間ではありません', 'It is not time to call the adjutant'));
        if (a.seat !== st.napoleon) return err(L('ナポレオンだけが指定できます', 'Only Napoleon can call a card'));
        if (!Cards.deck().includes(a.card)) return err(L('存在しない札です', 'No such card'));
        setCalled(st, a.card);
        ev.push({ t: 'call', card: a.card });
        // 交換札を取得
        st.hands[st.napoleon].push(...st.kitty);
        st.kitty = [];
        if (st.solo) st.napoleonKnowsSolo = true; // 自分の札 or 交換札にあった → 本人だけが知る
        st.phase = 'EXCHANGE'; st.turn = st.napoleon;
        ev.push({ t: 'takeKitty', seat: st.napoleon });
        return ok();
      }
      case 'exchange': {
        if (st.phase !== 'EXCHANGE') return err(L('交換の時間ではありません', 'It is not the exchange phase'));
        if (a.seat !== st.napoleon) return err(L('ナポレオンだけが交換できます', 'Only Napoleon can exchange'));
        const d = a.discards;
        const hand = st.hands[st.napoleon];
        if (!Array.isArray(d) || d.length !== 3 || new Set(d).size !== 3 || !d.every((c) => hand.includes(c))) return err(L('手札から3枚選んでください', 'Choose 3 cards from your hand'));
        st.hands[st.napoleon] = hand.filter((c) => !d.includes(c));
        st.discards = d.slice();
        // 指定札を表向き（得点札）で捨てた → その時点で単独戦が判明。非得点札なら局終了まで非公開
        if (d.includes(st.calledCard) && Cards.isPoint(st.calledCard)) { st.soloRevealed = true; ev.push({ t: 'soloRevealed', by: 'discard' }); }
        st.phase = 'PLAY'; st.trickNo = 0; st.leader = st.napoleon; st.turn = st.napoleon;
        ev.push({ t: 'exchange', publicDiscards: d.filter(Cards.isPoint), hiddenCount: d.filter((c) => !Cards.isPoint(c)).length });
        return ok();
      }
      case 'play': {
        if (st.phase !== 'PLAY') return err(L('札を出す時間ではありません', 'It is not time to play a card'));
        if (a.seat !== st.turn) return err(L('手番ではありません', 'It is not your turn'));
        const hand = st.hands[a.seat];
        if (!hand.includes(a.card)) return err(L('持っていない札です', 'You do not have that card'));
        const legal = legalPlays(hand, st.trick, st.requestedSuit, st.cfg);
        if (!legal.includes(a.card)) return err(illegalReason(a.card, hand, st.trick, st.requestedSuit, st.cfg));
        if (!st.trick.length) {
          if (a.card === JOKER) {
            if (!SUITS.includes(a.requestedSuit)) return err(L('ジョーカーで先手を取るときはマークを指定します', 'Leading with the Joker, you must name a suit'));
            st.requestedSuit = a.requestedSuit;
          } else st.requestedSuit = null;
        }
        st.hands[a.seat] = hand.filter((c) => c !== a.card);
        st.trick.push({ seat: a.seat, card: a.card });
        ev.push({ t: 'play', seat: a.seat, card: a.card, requestedSuit: st.trick.length === 1 ? st.requestedSuit : undefined });
        if (st.trick.length === 1 && isJokerRequest(st.trick, st.cfg)) ev.push({ t: 'jokerRequest', seat: a.seat });
        // 指定札が出た → 公開
        if (a.card === st.calledCard && !st.adjutantRevealed && !st.soloRevealed) {
          if (a.seat === st.napoleon) { st.soloRevealed = true; ev.push({ t: 'soloRevealed', by: 'play', seat: a.seat }); }
          else { st.adjutantRevealed = true; st.revealTrick = st.trickNo; ev.push({ t: 'adjutantRevealed', seat: a.seat }); }
        }
        if (st.trick.length === 5) {
          const res = resolveTrick(st.trick, { trump: st.trump, requestedSuit: st.requestedSuit, trickNo: st.trickNo, cfg: st.cfg });
          const discardPointCount = st.trickNo === 0 ? st.discards.filter(Cards.isPoint).length : 0;
          st.lastTrick = { trickNo: st.trickNo, leader: st.leader, cards: st.trick.slice(), requestedSuit: st.requestedSuit, ...res,
            playedPointCount: res.pointCardCount, discardPointCount };
          st.phase = 'TRICK_RESULT'; st.turn = null;
          ev.push({ t: 'trickEnd', ...st.lastTrick });
        } else st.turn = nextSeat(st.turn);
        return ok();
      }
      case 'collect': {
        if (st.phase !== 'TRICK_RESULT') return err(L('回収の時間ではありません', 'It is not time to collect'));
        const lt = st.lastTrick;
        const w = lt.winnerSeat;
        for (const x of lt.cards) if (Cards.isPoint(x.card)) st.wonCards[w].push(x.card);
        if (lt.trickNo === 0 && !st.discardsCollected) {
          for (const c of st.discards) if (Cards.isPoint(c)) st.wonCards[w].push(c);
          st.discardsCollected = true;
        }
        st.tricks.push(lt);
        ev.push({ t: 'collect', seat: w, playedPointCount: lt.playedPointCount, discardPointCount: lt.discardPointCount });
        st.trick = []; st.requestedSuit = null;
        if (st.tricks.length >= 10 || st.hands.every((h) => !h.length)) { finishRound(st, ev); return ok(); }
        st.trickNo++; st.leader = w; st.turn = w; st.phase = 'PLAY';
        return ok();
      }
      case 'next': {
        if (st.phase !== 'ROUND_RESULT') return err(L('結果表示中ではありません', 'The result is not being shown'));
        if (st.roundNo >= st.cfg.rounds) { st.phase = 'MATCH_RESULT'; ev.push({ t: 'matchEnd' }); return ok(); }
        st.dealer = nextSeat(st.dealer);
        deal(st);
        ev.push({ t: 'newRound' });
        return ok();
      }
    }
    return err(L('不明なアクション', 'Unknown action'));
  }

  function finishBidding(st, ev) {
    const b = st.currentBid;
    st.napoleon = b.seat; st.trump = b.suit; st.target = b.count;
    st.roundNo++; // 宣言が確定した局から局数に数える（配り直しは数えない）
    st.phase = 'CALL_ADJUTANT'; st.turn = b.seat;
    ev.push({ t: 'napoleon', seat: b.seat, suit: b.suit, count: b.count });
  }

  function finishRound(st, ev) {
    const team = [st.napoleon];
    if (!st.solo) team.push(st.adjutant);
    const napCount = team.reduce((n, s) => n + st.wonCards[s].length, 0);
    const total = st.wonCards.reduce((n, w) => n + w.length, 0);
    const success = napCount >= st.target;
    const r = { napoleon: st.napoleon, adjutant: st.solo ? null : st.adjutant, solo: st.solo, soloReason: st.soloReason,
      target: st.target, trump: st.trump, calledCard: st.calledCard, napCount, alliedCount: total - napCount, success,
      won: st.wonCards.map((w) => w.length) };
    const sc = scoreRound(r);
    r.row = sc.row; r.points = sc.pts;
    for (let i = 0; i < 5; i++) st.scores[i] += sc.pts[i];
    r.totals = st.scores.slice();
    r.roundNo = st.roundNo;
    st.result = r;
    st.roundResults.push(r);
    st.lastNapoleon = st.napoleon;
    st.adjutantRevealed = !st.solo; st.soloRevealed = st.solo;
    st.phase = 'ROUND_RESULT';
    ev.push({ t: 'roundEnd', result: r });
  }

  // 同率順位（合計ポイント）
  function rankings(scores) {
    return scores.map((v) => 1 + scores.filter((x) => x > v).length);
  }

  // ------------------------------------------------------------------ 観測情報（AI・ヒントはこれだけを受け取る）
  function publicVoids(tricks, trick, requestedSuit) {
    const voids = [new Set(), new Set(), new Set(), new Set(), new Set()];
    const scan = (cards, req) => {
      if (!cards.length) return;
      const fs = cards[0].card === JOKER ? req : Cards.suit(cards[0].card);
      for (let i = 1; i < cards.length; i++) {
        const c = cards[i].card;
        if (c !== JOKER && Cards.suit(c) !== fs) voids[cards[i].seat].add(fs);
      }
    };
    for (const t of tricks) scan(t.cards, t.requestedSuit);
    scan(trick, requestedSuit);
    return voids.map((v) => [...v]);
  }

  function getObservation(st, seat) {
    const isNap = st.napoleon === seat;
    let role = null;
    if (st.calledCard) role = isNap ? 'napoleon' : st.adjutant === seat ? 'adjutant' : 'allied';
    const revealedAdjutant = st.adjutantRevealed ? st.adjutant : null;
    const soloKnown = st.soloRevealed || (isNap && st.napoleonKnowsSolo);
    const publicDiscards = st.discards.filter(Cards.isPoint);
    const hiddenDiscardCount = st.discards.length - publicDiscards.length;
    const o = {
      seat, phase: st.phase, cfg: st.cfg, roundNo: st.roundNo, rounds: st.cfg.rounds, actionId: st.actionId,
      dealer: st.dealer, scores: st.scores.slice(),
      hand: st.hands[seat].slice(),
      handCounts: st.hands.map((h) => h.length),
      bids: st.bids.map((b) => ({ ...b })), currentBid: st.currentBid ? { ...st.currentBid } : null, turn: st.turn,
      napoleon: st.napoleon, trump: st.trump, target: st.target, calledCard: st.calledCard,
      role, // 自分の役職（本人は知っている）
      adjutantSeat: role === 'adjutant' ? seat : revealedAdjutant,
      adjutantRevealed: st.adjutantRevealed,
      solo: soloKnown ? true : (st.adjutantRevealed || role === 'adjutant' ? false : null), // null = 未判明
      soloRevealed: st.soloRevealed,
      publicDiscards, hiddenDiscardCount, discardsCollected: st.discardsCollected,
      myDiscards: isNap ? st.discards.slice() : null,
      trickNo: st.trickNo, leader: st.leader, trick: st.trick.map((x) => ({ ...x })), requestedSuit: st.requestedSuit,
      tricks: st.tricks.map((t) => ({ ...t, cards: t.cards.map((x) => ({ ...x })) })),
      lastTrick: st.lastTrick ? { ...st.lastTrick, cards: st.lastTrick.cards.map((x) => ({ ...x })) } : null,
      wonCounts: st.wonCards.map((w) => w.length),
      wonCards: st.wonCards.map((w) => w.slice()), // 回収された得点札は場に出た札＋公開捨て札なので公開情報
      voids: publicVoids(st.tricks, st.trick, st.requestedSuit),
      result: st.result,
    };
    if (st.phase === 'ROUND_RESULT' || st.phase === 'MATCH_RESULT') {
      o.adjutantSeat = st.solo ? null : st.adjutant; o.solo = st.solo;
    }
    o.legal = getLegalActions(st, seat);
    return o;
  }

  // 公開情報の表示用まとめ（副官未公開の間は軍別合計を出さない）
  function publicTally(o) {
    const nap = o.napoleon;
    if (nap == null) return null;
    const unrevealed = o.adjutantSeat == null && o.solo !== true;
    const pending = o.discardsCollected ? 0 : o.publicDiscards.length;
    if (o.adjutantRevealed || o.phase === 'ROUND_RESULT' || o.soloRevealed) {
      const team = [nap];
      if (o.adjutantRevealed && o.adjutantSeat != null && o.adjutantSeat !== nap) team.push(o.adjutantSeat);
      if ((o.phase === 'ROUND_RESULT' || o.phase === 'MATCH_RESULT') && o.result && o.result.adjutant != null && !team.includes(o.result.adjutant)) team.push(o.result.adjutant);
      const napTeam = team.reduce((n, s) => n + o.wonCounts[s], 0);
      const all = o.wonCounts.reduce((a, b) => a + b, 0);
      return { mode: 'teams', napTeam, allied: all - napTeam, pending, solo: o.soloRevealed };
    }
    return { mode: 'split', napoleonSelf: o.wonCounts[nap], others: o.wonCounts.reduce((a, b) => a + b, 0) - o.wonCounts[nap], pending, unrevealed };
  }

  // 全体の得点札保存チェック（テスト用）
  function pointConservation(st) {
    const won = st.wonCards.reduce((n, w) => n + w.length, 0);
    const inHands = st.hands.reduce((n, h) => n + h.filter(Cards.isPoint).length, 0);
    const inTrick = st.trick.filter((x) => Cards.isPoint(x.card)).length;
    const pendingDiscard = st.discardsCollected ? 0 : st.discards.filter(Cards.isPoint).length;
    const inKitty = st.kitty.filter(Cards.isPoint).length;
    return won + inHands + inTrick + pendingDiscard + inKitty;
  }

  Object.assign(NP, {
    Rng, rngFor, hashStr, Cards, RULES, RULE_NAME, normalizeConfig, REASONS, SCORE_ROWS,
    legalPlays, illegalReason, resolveTrick, explainWin, isJokerRequest, followSuitOf, same2Active,
    bidStrength, scoreRound, rankings, createGame, createScenario, getLegalActions, applyAction,
    getObservation, publicTally, publicVoids, pointConservation, nextSeat,
  });
})(typeof window !== 'undefined' ? window : globalThis);
