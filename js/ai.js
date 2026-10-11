// CPU。getObservation(state, seat) の戻り値だけを受け取る（相手の手札・非公開捨て札・真の副官は使わない）。
// 判断は観測情報＋判断用シードだけで決まる（演出タイマーや非公開情報に依存しない）。
'use strict';
(function (root) {
  const NP = root.NP;
  const { Cards, legalPlays, resolveTrick, rngFor } = NP;
  const JK = Cards.JOKER;
  const SUITS = Cards.SUITS;

  // キャラの個性（安全策・攻め方のみ。合法手と情報制限は共通）
  const STYLES = {
    you: { risk: 0, name: '標準' },
    crow: { risk: 0.4, name: '攻め' },
    mira: { risk: 0.1, name: 'バランス' },
    ren: { risk: -0.5, name: '堅実' },
    luna: { risk: 0.9, name: '大胆' },
  };

  // ------------------------------------------------------------------ 手札の強さ（競り・交換・副官指定）
  // 切札 trump のときの「取れそうな巡の数」の目安
  function handPower(hand, trump, cfg) {
    const L = Cards.LEFT_SUIT[trump];
    let p = 0;
    const has = (c) => hand.includes(c);
    if (has('S14')) p += 1.0;
    if (has(JK)) p += 0.95;
    if (has(trump + '11')) p += 0.9;
    if (has(L + '11')) p += 0.8;
    const trumps = hand.filter((c) => c !== JK && Cards.suit(c) === trump && c !== trump + '11' && c !== 'S14');
    for (const c of trumps) {
      const r = Cards.rank(c);
      p += r === 14 ? 0.75 : r === 13 ? 0.55 : r === 12 ? 0.42 : 0.3;
    }
    const nTrump = trumps.length + (has(trump + '11') ? 1 : 0) + (has(L + '11') ? 1 : 0);
    for (const s of SUITS) {
      if (s === trump) continue;
      const cs = hand.filter((c) => c !== JK && Cards.suit(c) === s && !(c === L + '11') && c !== 'S14');
      if (cs.some((c) => Cards.rank(c) === 14)) p += 0.55;
      if (cs.some((c) => Cards.rank(c) === 13) && cs.some((c) => Cards.rank(c) === 14)) p += 0.25;
      if (!cs.length && nTrump >= 3) p += 0.35; // 切れていれば切札で取れる
      else if (cs.length === 1 && nTrump >= 4) p += 0.12;
    }
    if (cfg && cfg.yoromeki && has('H12') && !has('S14')) p += 0.15;
    return p;
  }
  // 競りの目安: ナポレオン軍の得点札の見込み（副官・交換札の分を含む）
  const TUNE = { base: 7.0, per: 1.75 }; // tests/sim.js で調整（成功率おおむね5割・配り直し少なめ）
  function estimatePoints(hand, trump, cfg) {
    return TUNE.base + handPower(hand, trump, cfg) * TUNE.per;
  }
  function bestTrump(hand, cfg) {
    let best = null;
    for (const s of SUITS) {
      const e = estimatePoints(hand, s, cfg);
      if (!best || e > best.est + 1e-9) best = { suit: s, est: e };
    }
    return best;
  }

  function chooseBid(o, style, level, rng) {
    const best = bestTrump(o.hand, o.cfg);
    const noise = level === 'easy' ? (rng.next() - 0.5) * 1.6 : 0;
    const maxBid = Math.min(20, Math.floor(best.est + style.risk * 0.8 + noise));
    const cur = o.currentBid;
    let count = o.cfg.minBid;
    if (cur) count = NP.bidStrength({ suit: best.suit, count: cur.count }) > NP.bidStrength(cur) ? cur.count : cur.count + 1;
    if (count <= maxBid && count >= o.cfg.minBid) return { type: 'bid', seat: o.seat, suit: best.suit, count, est: best.est };
    return { type: 'pass', seat: o.seat, est: best.est, bestSuit: best.suit };
  }

  // 副官に指定する札: 自分にない強札の順
  function callOrder(trump) {
    const L = Cards.LEFT_SUIT[trump];
    const order = ['S14', JK, trump + '11', L + '11'];
    for (const r of [14, 13, 12]) order.push(trump + r);
    for (const s of SUITS) if (s !== trump && s + '14' !== 'S14') order.push(s + '14');
    for (const r of [10, 9, 8, 7]) order.push(trump + r);
    for (const s of SUITS) if (s !== trump) order.push(s + '13');
    return order.filter((c, i, a) => a.indexOf(c) === i);
  }
  function chooseCall(o) {
    const pick = callOrder(o.trump).find((c) => !o.hand.includes(c));
    return { type: 'call', seat: o.seat, card: pick || 'JK' };
  }

  // 交換: 13枚から3枚捨てる組み合わせを全部評価（286通り）
  function chooseDiscards(o, level, rng) {
    const hand = o.hand;
    const trump = o.trump;
    const firstLeadStrong = hand.includes('S14') || hand.includes(JK);
    let best = null;
    for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) for (let k = j + 1; k < hand.length; k++) {
      const d = [hand[i], hand[j], hand[k]];
      if (d.includes(o.calledCard) && o.solo !== true) continue; // 念のため（他席が持っていれば手札にない）
      const keep = hand.filter((c) => !d.includes(c));
      let v = handPower(keep, trump, o.cfg);
      const pts = d.filter(Cards.isPoint).length;
      v -= pts * (firstLeadStrong ? 0.08 : 0.22); // 捨てた得点札は初巡の勝者が取る
      // 小さい通常札を捨てるのを好む（同点の目安）
      for (const c of d) if (c !== JK && Cards.suit(c) !== trump) v += (14 - Cards.rank(c)) * 0.004;
      if (level === 'easy') v += (rng.next() - 0.5) * 0.3;
      if (!best || v > best.v + 1e-9) best = { v, d };
    }
    return { type: 'exchange', seat: o.seat, discards: best.d };
  }

  // ------------------------------------------------------------------ 札出し
  // 観測から「見えていない札」を作る
  function unseenCards(o) {
    const seen = new Set(o.hand);
    for (const t of o.tricks) for (const x of t.cards) seen.add(x.card);
    for (const x of o.trick) seen.add(x.card);
    for (const c of o.publicDiscards) seen.add(c);
    if (o.myDiscards) for (const c of o.myDiscards) seen.add(c);
    return Cards.deck().filter((c) => !seen.has(c));
  }

  // 自分から見た各席の「味方らしさ」0..1
  function friendProbs(o) {
    const me = o.seat, nap = o.napoleon;
    const f = [0, 0, 0, 0, 0];
    f[me] = 1;
    const others = [0, 1, 2, 3, 4].filter((s) => s !== me);
    const calledSuit = Cards.suit(o.calledCard);
    const canHoldCalled = (s) => !(calledSuit && o.voids[s].includes(calledSuit));
    if (o.role === 'napoleon') {
      if (o.solo === true) return f;
      if (o.adjutantSeat != null) { f[o.adjutantSeat] = 1; return f; }
      const c = others.filter(canHoldCalled);
      for (const s of c) f[s] = 1 / Math.max(1, c.length);
      return f;
    }
    if (o.role === 'adjutant') { f[nap] = 1; return f; }
    // 連合軍
    for (const s of others) f[s] = 1;
    f[nap] = 0;
    if (o.adjutantSeat != null) { f[o.adjutantSeat] = 0; return f; }
    if (o.solo === true) return f;
    const cands = others.filter((s) => s !== nap && canHoldCalled(s));
    const pool = cands.reduce((n, s) => n + o.handCounts[s], 0) + o.handCounts[nap] + o.hiddenDiscardCount + 1;
    for (const s of cands) f[s] = 1 - o.handCounts[s] / pool;
    return f;
  }

  // 札の「温存価値」
  function cardCost(c, o, unseen) {
    const trump = o.trump;
    if (c === 'S14') return 3.0;
    if (c === JK) return 2.6;
    if (c === trump + '11') return 2.2;
    if (c === Cards.LEFT_SUIT[trump] + '11') return 2.0;
    const r = Cards.rank(c), s = Cards.suit(c);
    if (c === 'H12' && o.cfg.yoromeki && unseen.includes('S14')) return 1.3;
    if (s === trump) return 0.6 + ((r - 2) / 12) * 1.1;
    if (r === 14) return 0.9;
    if (r === 13) return 0.4;
    if (c === 'C3' && o.cfg.jokerRequest && unseen.includes(JK)) return 0.35;
    return ((r - 2) / 12) * 0.3;
  }

  // 後から出す席が今の最強札を上回る確率の目安
  function beatProb(cards, o, later, unseen, enemyW) {
    if (!later.length) return 0;
    const ctx = { trump: o.trump, requestedSuit: o.requestedSuit || (cards[0] && cards[0].card === JK ? cards[0].req : null), trickNo: o.trickNo, cfg: o.cfg };
    const fs = cards[0].card === JK ? ctx.requestedSuit : Cards.suit(cards[0].card);
    const threats = unseen.filter((x) => {
      const r = resolveTrick([...cards, { seat: 9, card: x }], ctx);
      return r && r.winnerSeat === 9;
    });
    const U = Math.max(1, unseen.length);
    const leadUnseen = unseen.filter((x) => x !== JK && Cards.suit(x) === fs).length;
    let keep = 1;
    for (const p of later) {
      const h = o.handCounts[p];
      if (!h) continue;
      const q = Math.min(0.95, h / U);
      const voidKnown = o.voids[p].includes(fs);
      const pVoid = voidKnown ? 1 : Math.pow(1 - q, leadUnseen);
      let pNoLeadThreat = 1, pNoOffThreat = 1, pJoker = 0;
      for (const x of threats) {
        if (x === JK) { pJoker = q; continue; }
        if (Cards.suit(x) === fs) { if (!voidKnown) pNoLeadThreat *= 1 - q; }
        else pNoOffThreat *= 1 - q;
      }
      let pBeat = (1 - pNoLeadThreat) + pVoid * (1 - pNoOffThreat) + pJoker;
      pBeat = Math.min(0.97, pBeat);
      keep *= 1 - pBeat * enemyW(p);
    }
    return 1 - keep;
  }

  function scorePlays(o, level, rng, style = STYLES.you) {
    const legal = o.legal.filter((a) => a.type === 'play');
    const unseen = unseenCards(o);
    const f = friendProbs(o);
    const team = (s) => 2 * f[s] - 1;
    const me = o.seat;
    const played = o.trick.length;
    const later = [];
    for (let k = 1; k < 5 - played; k++) later.push((me + k) % 5);
    const ptsUnseen = unseen.filter(Cards.isPoint).length;
    const density = ptsUnseen / Math.max(1, unseen.length);
    const curPts = o.trick.filter((x) => Cards.isPoint(x.card)).length + (o.trickNo === 0 && !o.discardsCollected ? o.publicDiscards.length : 0);
    const remainFactor = (10 - o.trickNo) / 10;
    const napTeam = o.role === 'napoleon' || o.role === 'adjutant';
    const myTrumps = o.hand.filter((c) => c !== JK && Cards.suit(c) === o.trump).length;
    const results = [];
    for (const a of legal) {
      const c = a.card;
      const cards = [...o.trick, { seat: me, card: c, req: a.requestedSuit }];
      const ctx = { trump: o.trump, requestedSuit: played ? o.requestedSuit : a.requestedSuit || null, trickNo: o.trickNo, cfg: o.cfg };
      const res = resolveTrick(cards, ctx);
      const w = res.winnerSeat;
      const laterGive = later.length * density * 0.75;
      const P = curPts + (Cards.isPoint(c) ? 1 : 0) + laterGive;
      // 後続の「敵らしさ」は今の勝者から見て
      const enemyW = (p) => Math.max(0.15, 1 - (w === me ? f[p] : (f[p] * f[w] + (1 - f[p]) * (1 - f[w]))) * 0.85);
      const pBeat = later.length ? beatProb(cards.map((x) => ({ ...x, req: ctx.requestedSuit })), { ...o, requestedSuit: ctx.requestedSuit }, later, unseen.filter((x) => x !== c), enemyW) : 0;
      // 上回られたら、上回るのはたいてい今の勝者の敵
      const ev = P * ((1 - pBeat) * team(w) - pBeat * team(w) * 0.6);
      const cost = cardCost(c, o, unseen) * (0.25 + 0.55 * remainFactor);
      let score = ev - cost * (w === me ? 0.55 : 1);
      // 先手の方針
      if (!played) {
        if (napTeam && c !== JK && Cards.suit(c) === o.trump && myTrumps >= 4 && o.trickNo < 6) score += 0.25; // 切札を引き出す
        if (!napTeam && c !== JK && Cards.suit(c) === o.trump && f[o.napoleon] === 0) score -= 0.2;
        if (c === 'C3' && o.cfg.jokerRequest && unseen.includes(JK)) score += 0.45; // 相手のジョーカーを使わせる
        if (Cards.isPoint(c) && w === me && pBeat > 0.5) score -= 0.4;
      }
      // 味方が取りそうなら得点札を渡す
      if (played && w !== me && f[w] >= 0.95 && Cards.isPoint(c) && pBeat < 0.35) score += 0.35;
      score *= 1 + style.risk * 0.05;
      if (level === 'easy') score += (rng.next() - 0.5) * 1.2;
      else score += (rng.next() - 0.5) * 0.02;
      results.push({ action: a, score, winNow: w === me, pBeat, P, res });
    }
    results.sort((x, y) => y.score - x.score);
    return results;
  }

  // 先手ジョーカーの要求マーク
  function chooseJokerSuit(o) {
    const napTeam = o.role === 'napoleon' || o.role === 'adjutant';
    if (napTeam) return o.trump;
    // 連合軍: ナポレオンが切れているマーク以外で、自分がいちばん多く持つ非切札
    const counts = {};
    for (const s of SUITS) counts[s] = o.hand.filter((c) => c !== JK && Cards.suit(c) === s).length;
    const cand = SUITS.filter((s) => s !== o.trump && !(o.napoleon != null && o.voids[o.napoleon].includes(s)));
    cand.sort((a, b) => counts[b] - counts[a]);
    return cand[0] || o.trump;
  }

  function choosePlay(o, level, rng, style) {
    const scored = scorePlays(o, level, rng, style);
    // ジョーカーの先手は要求マークを1つに絞る
    const js = !o.trick.length ? chooseJokerSuit(o) : null;
    const pick = scored.find((r) => r.action.card !== JK || o.trick.length || r.action.requestedSuit === js) || scored[0];
    return pick.action;
  }

  // 判断用シード（観測情報だけで決まる key）
  function decisionRng(o, aiSeed) {
    return rngFor(aiSeed, o.roundNo, o.phase, o.trickNo, o.trick.length, o.seat, o.bids.length, o.hand.length);
  }

  function decide(o, opts = {}) {
    const level = opts.level || 'standard';
    const style = STYLES[opts.charId] || STYLES.you;
    const rng = decisionRng(o, opts.seed || 'ai');
    switch (o.phase) {
      case 'BIDDING': { const a = chooseBid(o, style, level, rng); return { type: a.type, seat: a.seat, suit: a.suit, count: a.count }; }
      case 'CALL_ADJUTANT': return chooseCall(o);
      case 'EXCHANGE': return chooseDiscards(o, level, rng);
      case 'PLAY': return choosePlay(o, level, rng, style);
    }
    return null;
  }

  NP.AI = { TUNE, decide, handPower, estimatePoints, bestTrump, chooseBid, chooseCall, callOrder, chooseDiscards, scorePlays,
    chooseJokerSuit, friendProbs, unseenCards, STYLES };
})(typeof window !== 'undefined' ? window : globalThis);
