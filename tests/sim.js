// CPU対CPUのシミュレーション（node tests/sim.js [局数]）。仕様13章 10〜12 と CPU の傾向を確認する
'use strict';
const path = require('path');
for (const f of ['engine.js', 'ai.js']) require(path.join(__dirname, '..', 'js', f));
const NP = globalThis.NP;
const { createGame, applyAction, getObservation, getLegalActions, Cards, normalizeConfig } = NP;

const N = parseInt(process.argv[2] || '1000', 10);
let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log('FAIL ' + msg); } };
const CHARS = ['you', 'crow', 'mira', 'ren', 'luna'];

// 1局を最後まで（配り直しを含む）。trace に全アクションを記録
function playRound(st, opts = {}) {
  const trace = [];
  let guard = 0;
  while (!['ROUND_RESULT', 'MATCH_RESULT'].includes(st.phase)) {
    if (++guard > 2000) { check(false, 'ループが終わらない'); break; }
    if (st.phase === 'REDEAL_WAIT') { applyAction(st, { type: 'redeal' }); trace.push('redeal'); continue; }
    if (st.phase === 'TRICK_RESULT') {
      check(NP.pointConservation(st) === 20, '巡の途中で得点札20枚');
      applyAction(st, { type: 'collect' }); continue;
    }
    const seat = st.phase === 'BIDDING' || st.phase === 'PLAY' ? st.turn : st.napoleon;
    const o = getObservation(st, seat);
    const a = NP.AI.decide(o, { level: opts.level || 'standard', charId: CHARS[seat], seed: st.seed });
    const legal = getLegalActions(st, seat);
    if (a.type === 'play') check(legal.some((l) => l.card === a.card && (l.requestedSuit || null) === (a.requestedSuit || null)), 'AIの手が合法 ' + a.card);
    const r = applyAction(st, a);
    if (!r.ok) { check(false, 'AIの手が拒否: ' + r.error + ' ' + JSON.stringify(a)); break; }
    trace.push(JSON.stringify(a));
    if (st.phase === 'PLAY' || st.phase === 'EXCHANGE') {
      const cards = st.hands.flat().length + st.trick.length + st.tricks.reduce((n, t) => n + t.cards.length, 0) + st.discards.length + st.kitty.length;
      check(cards === 53, '札の総数53');
    }
  }
  return trace;
}

// ルールは温泉準拠のみ（最低1,000局）
const presets = [{}];
const stats = { rounds: 0, success: 0, solo: 0, soloWin: 0, bids: {}, napSeat: [0, 0, 0, 0, 0], pts: [0, 0, 0, 0, 0], reasons: {}, redeals: 0, overbid: 0, napCount: 0 };
const t0 = Date.now();
for (let pi = 0; pi < presets.length; pi++) {
  const games = N;
  for (let g = 0; g < games; g++) {
    const st = createGame({ ...presets[pi], rounds: 5 }, `sim-${pi}-${g}`);
    while (st.phase !== 'MATCH_RESULT') {
      const tr = playRound(st);
      stats.redeals += tr.filter((x) => x === 'redeal').length;
      if (st.phase !== 'ROUND_RESULT') break;
      const r = st.result;
      check(st.tricks.length === 10, '10巡プレイ');
      check(r.napCount + r.alliedCount === 20, '軍合計20枚');
      check(st.wonCards.flat().length === 20 && new Set(st.wonCards.flat()).size === 20, '得点札20枚・重複なし');
      check(r.points.reduce((a, b) => a + b, 0) >= 0, '得点は加算のみ');
      if (pi === 0) {
        stats.rounds++; if (r.success) stats.success++; if (r.solo) { stats.solo++; if (r.success) stats.soloWin++; }
        stats.bids[r.target] = (stats.bids[r.target] || 0) + 1; stats.napSeat[r.napoleon]++;
        stats.napCount += r.napCount;
        if (r.napCount < r.target - 4) stats.overbid++;
        for (const t of st.tricks) stats.reasons[t.reasonCode] = (stats.reasons[t.reasonCode] || 0) + 1;
      }
      applyAction(st, { type: 'next' });
    }
    if (pi === 0) st.scores.forEach((v, i) => (stats.pts[i] += v));
    check(st.roundResults.length === 5, '5局で終了');
    const sum = st.roundResults.reduce((a, r) => a.map((v, i) => v + r.points[i]), [0, 0, 0, 0, 0]);
    check(JSON.stringify(sum) === JSON.stringify(st.scores), '合計ポイント一致');
  }
}
const ms = Date.now() - t0;

// ---- 10. 同じシード・同じ操作で同じ結果
{
  const a = createGame({ preset: 'standard' }, 'det'); const b = createGame({ preset: 'standard' }, 'det');
  const ta = playRound(a), tb = playRound(b);
  check(JSON.stringify(ta) === JSON.stringify(tb) && JSON.stringify(a.result) === JSON.stringify(b.result), '同じシードで同じ結果');
}
// ---- 11. 同じ観測情報で非公開札の割当だけ違う → 同じ判断
{
  let same = 0, total = 0;
  for (let g = 0; g < 60; g++) {
    const st = createGame({ preset: 'standard' }, 'leak-' + g);
    // 数巡進める
    let steps = 0;
    while (st.phase !== 'ROUND_RESULT' && steps < 40 + (g % 30)) {
      if (st.phase === 'REDEAL_WAIT') { applyAction(st, { type: 'redeal' }); continue; }
      if (st.phase === 'TRICK_RESULT') { applyAction(st, { type: 'collect' }); continue; }
      const seat = st.phase === 'BIDDING' || st.phase === 'PLAY' ? st.turn : st.napoleon;
      applyAction(st, NP.AI.decide(getObservation(st, seat), { seed: 'x' }));
      steps++;
    }
    if (st.phase !== 'PLAY') continue;
    const me = st.turn;
    // 自分以外の席の手札（＋非公開捨て札）をシャッフルし直す（枚数・公開情報は保つ）
    const st2 = JSON.parse(JSON.stringify(st));
    st2.cfg = st.cfg;
    const others = [0, 1, 2, 3, 4].filter((s) => s !== me);
    // 席ごとの「出せないマーク」を保つため、同じマーク同士の入れ替えだけを行う
    const pool = others.flatMap((s) => st2.hands[s].map((c, i) => ({ s, i, c })));
    const rng = new NP.Rng('swap' + g);
    if (pool.length < 2) continue;
    for (let k = 0; k < 30; k++) {
      const x = pool[rng.int(pool.length)], y = pool[rng.int(pool.length)];
      if (x.s === y.s) continue;
      const sx = Cards.suit(x.c), sy = Cards.suit(y.c);
      if (sx !== sy || x.c === st.calledCard || y.c === st.calledCard) continue;
      [st2.hands[x.s][x.i], st2.hands[y.s][y.i]] = [y.c, x.c];
      [x.c, y.c] = [y.c, x.c];
    }
    const o1 = getObservation(st, me), o2 = getObservation(st2, me);
    if (JSON.stringify(o1) !== JSON.stringify(o2)) { check(false, '観測情報が非公開札で変わった'); continue; }
    const d1 = NP.AI.decide(o1, { seed: 'k' }), d2 = NP.AI.decide(o2, { seed: 'k' });
    total++; if (JSON.stringify(d1) === JSON.stringify(d2)) same++;
  }
  check(total > 10 && same === total, `非公開札の割当で判断が変わらない (${same}/${total})`);
  console.log(`情報制限: 非公開札の割当だけ変えた${total}場面で判断が同一 ${same}/${total}`);
}

const pct = (a, b) => ((100 * a) / Math.max(1, b)).toFixed(1) + '%';
console.log(`標準 ${N}マッチ×5局 = ${stats.rounds}局 完走 (${ms}ms)`);
console.log(`宣言成功率 ${pct(stats.success, stats.rounds)}  単独戦 ${stats.solo}局（成功 ${stats.soloWin}）  配り直し ${stats.redeals}回`);
console.log(`宣言枚数分布 ${JSON.stringify(stats.bids)}  平均獲得 ${(stats.napCount / stats.rounds).toFixed(2)}枚  大幅未達(目標-5以下) ${pct(stats.overbid, stats.rounds)}`);
console.log(`ナポレオンになった席 ${JSON.stringify(stats.napSeat)}  席別ポイント ${JSON.stringify(stats.pts)}`);
console.log(`勝因 ${JSON.stringify(stats.reasons)}`);
console.log(fails ? `NG fail ${fails}` : 'OK');
process.exit(fails ? 1 : 0);
