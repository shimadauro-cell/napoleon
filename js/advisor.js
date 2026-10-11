// ヒント。getObservation の戻り値（本人に見えている情報）だけで、おすすめと理由を出す。
// 押すと札を選ぶだけで、確定は人間が行う。副官未公開の人物を「味方です」と断定しない。
'use strict';
(function (root) {
  const NP = root.NP;
  const { Cards, AI } = NP;
  const T = NP.L || ((ja) => ja);
  const sym = (s) => Cards.SUIT_SYM[s];
  const CL = (c) => Cards.label(c);
  const list = (cs) => cs.map(CL).join(T('・', ', '));
  const pc = (n) => (n === 1 ? 'point card' : 'point cards'); // 英語の単数・複数

  function roleWord(o, seat, names) {
    if (seat === o.seat) return T('あなた', 'You');
    if (seat === o.napoleon) return T(`ナポレオン（${names[seat]}）`, `Napoleon (${names[seat]})`);
    if (o.adjutantSeat === seat) return T(`副官（${names[seat]}）`, `the adjutant (${names[seat]})`);
    return names[seat];
  }

  function bidHint(o) {
    const best = AI.bestTrump(o.hand, o.cfg);
    const t = best.suit;
    const trumps = o.hand.filter((c) => c !== 'JK' && Cards.suit(c) === t).length;
    const specials = ['S14', 'JK', t + '11', Cards.LEFT_SUIT[t] + '11'].filter((c) => o.hand.includes(c));
    const pts = o.hand.filter(Cards.isPoint).length;
    const est = Math.floor(best.est - 0.3); // ヒントは保守的に
    const cur = o.currentBid;
    let count = o.cfg.minBid;
    if (cur) count = NP.bidStrength({ suit: t, count: cur.count }) > NP.bidStrength(cur) ? cur.count : cur.count + 1;
    const why = T(`${sym(t)}が${trumps}枚${specials.length ? `、役札 ${list(specials)}` : ''}、得点札${pts}枚。見込みは副官の分を含めて約${Math.round(best.est)}枚。`,
      `${trumps} ${sym(t)}${specials.length ? `, specials: ${list(specials)}` : ''}, ${pts} ${pc(pts)}. Estimated point cards for your team: about ${Math.round(best.est)}.`);
    if (count <= est && count <= 20) {
      return { kind: 'bid', action: { type: 'bid', suit: t, count }, title: T(`${sym(t)}${count}枚の宣言`, `Bid ${sym(t)}${count}`),
        text: T(`${why} ${sym(t)}を切札にすると戦えそうです。宣言は勝利の保証ではありません。`, `${why} ${sym(t)} as trump looks playable. A bid is never a guaranteed win.`) };
    }
    return { kind: 'pass', action: { type: 'pass' }, title: T('パス', 'Pass'),
      text: T(`${why} ${count}枚を取るには少し弱いので、パスが安全です。${cur ? '' : '全員パスなら配り直しです。'}`,
        `${why} A bit weak for ${count}, so passing is safer.${cur ? '' : ' If everyone passes, the cards are redealt.'}`) };
  }

  function callHint(o) {
    const a = AI.chooseCall(o);
    const name = Cards.roleName(a.card, o.trump, o.cfg);
    return { kind: 'call', action: a, title: T(`${CL(a.card)}${name ? `（${name}）` : ''}を指定`, `Call ${CL(a.card)}${name ? ` (${name})` : ''}`),
      text: T('あなたが持っていない、いちばん強い札です。この札を持つ人が秘密の味方（副官）になります。交換札の中にある場合は1対4になります。',
        'The strongest card you do not hold. Whoever has it becomes your secret partner (the adjutant). If it is in the kitty, you play 1 vs 4.') };
  }

  function exchangeHint(o) {
    const a = AI.chooseDiscards(o, 'standard', NP.rngFor('hint'));
    const pts = a.discards.filter(Cards.isPoint);
    return { kind: 'exchange', action: a, title: T(`${list(a.discards)} を捨てる`, `Discard ${list(a.discards)}`),
      text: T(`切札と役札を残し、弱い札を捨てます。${pts.length ? `捨てる得点札${pts.length}枚は最初の巡の勝者が取ります。` : '得点札は捨てません。'}マークを1つ無くすと、そのマークが出たとき切札で取れます。`,
        `Keep trumps and specials, discard weak cards. ${pts.length ? (pts.length === 1 ? 'The point card you discard goes to the winner of the first trick.' : `The ${pts.length} point cards you discard go to the winner of the first trick.`) : 'No point cards are discarded.'} Emptying a suit lets you trump it later.`) };
  }

  function playHint(o, names) {
    const scored = AI.scorePlays(o, 'standard', NP.rngFor('hint', o.trickNo, o.trick.length));
    if (!scored.length) return null;
    const js = !o.trick.length ? AI.chooseJokerSuit(o) : null;
    const top = scored.find((r) => r.action.card !== 'JK' || o.trick.length || r.action.requestedSuit === js) || scored[0];
    const a = top.action, c = a.card;
    const f = AI.friendProbs(o);
    const reasons = [];
    if (o.trick.length) {
      const fs = NP.followSuitOf(o.trick, o.requestedSuit);
      if (NP.isJokerRequest(o.trick, o.cfg) && o.hand.includes('JK')) reasons.push(T('♣3のジョーカー請求なので、ジョーカーを出します。', 'The ♣3 lead is a Joker Call, so you play the Joker.'));
      else if (o.hand.some((x) => x !== 'JK' && Cards.suit(x) === fs)) reasons.push(T(`${sym(fs)}を持っているので、この中から選びます。`, `You have ${sym(fs)}, so pick from those.`));
      else reasons.push(T(`${sym(fs)}を持っていないので、どの札でも出せます。`, `You have no ${sym(fs)}, so any card is allowed.`));
    }
    if (top.winNow) {
      if (top.pBeat < 0.2) reasons.push(T(`${CL(c)}なら今の場でいちばん強く、取れる見込みが高いです。`, `${CL(c)} is the strongest here and likely to win the trick.`));
      else reasons.push(T(`${CL(c)}で今は暫定トップですが、後から上回られる可能性もあります。`, `${CL(c)} leads for now, but a later card may beat it.`));
    } else {
      const w = top.res.winnerSeat;
      if (f[w] >= 0.99 && w !== o.seat) reasons.push(T(`${roleWord(o, w, names)}が取りそうなので${Cards.isPoint(c) ? '得点札を渡します' : '弱い札で様子を見ます'}。`,
        `${roleWord(o, w, names)} is likely to win, so ${Cards.isPoint(c) ? 'feed them a point card' : 'play low and wait'}.`));
      else if (f[w] > 0.6 && w !== o.seat) reasons.push(T(`${names[w]}は味方の可能性があります（まだ断定はできません）。`, `${names[w]} may be on your side (not certain yet).`));
      else reasons.push(Cards.isPoint(c) ? T('取れそうにありませんが、ほかに出せる札が得点札だけです。', 'You are unlikely to win this trick, and your playable cards are all point cards.')
        : T('取れそうにないので、得点札を渡さないよう弱い札を出します。', 'You are unlikely to win this trick, so play a low card to avoid giving away point cards.'));
    }
    if (c === 'JK' && !o.trick.length) reasons.push(T(`ジョーカーで先手を取るときは、出してほしいマーク（${sym(a.requestedSuit)}）を指定します。`, `When leading the Joker, name the suit others must play (${sym(a.requestedSuit)}).`));
    const alt = scored.find((r) => r.action.card !== c);
    return { kind: 'play', action: a, title: `${CL(c)}${a.requestedSuit && !o.trick.length ? T(`（${sym(a.requestedSuit)}を指定）`, ` (call ${sym(a.requestedSuit)})`) : ''}`,
      text: reasons.join(' ') + (alt ? T(` 別の候補：${CL(alt.action.card)}。`, ` Alternative: ${CL(alt.action.card)}.`) : ''), note: T('おすすめは勝利の保証ではありません。', 'Suggestions are not a guaranteed win.') };
  }

  function hint(o, names) {
    switch (o.phase) {
      case 'BIDDING': return o.turn === o.seat ? bidHint(o) : null;
      case 'CALL_ADJUTANT': return o.napoleon === o.seat ? callHint(o) : null;
      case 'EXCHANGE': return o.napoleon === o.seat ? exchangeHint(o) : null;
      case 'PLAY': return o.turn === o.seat ? playHint(o, names) : null;
    }
    return null;
  }

  NP.Advisor = { hint, bidHint, callHint, exchangeHint, playHint };
})(typeof window !== 'undefined' ? window : globalThis);
