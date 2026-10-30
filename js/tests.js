// ルールテスト（ブラウザの tests.html と Node の tests/run.js で共通）。仕様13章の 1〜9, 16〜19 を中心に検証する
'use strict';
(function (root) {
  const NP = root.NP;
  const { Cards, resolveTrick, legalPlays, createGame, createScenario, applyAction, getObservation, scoreRound, normalizeConfig } = NP;

  function run(out) {
    let pass = 0, fail = 0;
    const check = (cond, msg) => { if (cond) pass++; else { fail++; out('FAIL ' + msg); } };
    const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
    const STD = normalizeConfig({ preset: 'standard' });
    const T = (cards, trump, opts = {}) => resolveTrick(cards.map((c, i) => ({ seat: i, card: c })),
      { trump, requestedSuit: opts.req || null, trickNo: opts.trickNo == null ? 3 : opts.trickNo, cfg: opts.cfg || STD });
    const W = (cards, trump, opts) => { const r = T(cards, trump, opts); return [r.winnerSeat, r.reasonCode]; };

    // ---- 1. 配札
    {
      const st = createGame({ preset: 'standard' }, 'deal-1');
      const all = [...st.hands.flat(), ...st.kitty];
      eq(st.hands.map((h) => h.length), [10, 10, 10, 10, 10], '配札: 10枚ずつ');
      eq(st.kitty.length, 3, '配札: 交換札3枚');
      eq(new Set(all).size, 53, '配札: 53枚・重複なし');
    }
    // ---- 2. 競り
    {
      const st = createGame({ preset: 'standard' }, 'bid-1');
      const s0 = st.turn;
      const seat = (k) => (s0 + k) % 5;
      check(applyAction(st, { type: 'bid', seat: s0, suit: 'H', count: 13 }).ok, '競り: ♥13');
      check(!applyAction(st, { type: 'bid', seat: seat(1), suit: 'D', count: 13 }).ok, '競り: ♦13は♥13より弱いので拒否');
      check(!applyAction(st, { type: 'bid', seat: seat(1), suit: 'H', count: 13 }).ok, '競り: 同じ宣言は拒否');
      check(applyAction(st, { type: 'bid', seat: seat(1), suit: 'S', count: 13 }).ok, '競り: ♠13は♥13より強い');
      check(applyAction(st, { type: 'bid', seat: seat(2), suit: 'C', count: 14 }).ok, '競り: ♣14は♠13より強い');
      check(!applyAction(st, { type: 'bid', seat: seat(3), suit: 'S', count: 21 }).ok, '競り: 21枚は拒否');
      check(applyAction(st, { type: 'pass', seat: seat(3) }).ok, '競り: パス');
      check(applyAction(st, { type: 'pass', seat: seat(4) }).ok, '競り: パス');
      // seat(0) はパス後でも再入札できる
      check(applyAction(st, { type: 'bid', seat: seat(0), suit: 'H', count: 14 }).ok, '競り: パス後の再入札');
      eq(st.passStreak, 0, '競り: 上位宣言でパス数リセット');
      eq(st.turn, seat(1), '競り: 手番が次へ');
      for (const k of [1, 2, 3, 4]) check(applyAction(st, { type: 'pass', seat: seat(k) }).ok, '競り: パス' + k);
      eq([st.phase, st.napoleon, st.trump, st.target], ['CALL_ADJUTANT', seat(0), 'H', 14], '競り: 4人連続パスで確定');
      check(!applyAction(st, { type: 'pass', seat: seat(1) }).ok, '競り: 確定後のパスは拒否');
    }
    {
      // 現宣言者を飛ばす
      const st = createGame({ preset: 'standard' }, 'bid-skip');
      const s0 = st.turn;
      applyAction(st, { type: 'pass', seat: s0 });
      applyAction(st, { type: 'bid', seat: (s0 + 1) % 5, suit: 'C', count: 13 });
      for (const k of [2, 3, 4, 0]) applyAction(st, { type: 'pass', seat: (s0 + k) % 5 });
      eq([st.phase, st.napoleon], ['CALL_ADJUTANT', (s0 + 1) % 5], '競り: 宣言者以外の4人パスで確定（パス→宣言の順でも）');
    }
    {
      // 全員パス → 配り直し（局数に入らない）
      const st = createGame({ preset: 'standard' }, 'bid-allpass');
      const s0 = st.turn, d0 = st.dealer;
      for (let k = 0; k < 5; k++) applyAction(st, { type: 'pass', seat: (s0 + k) % 5 });
      eq(st.phase, 'REDEAL_WAIT', '競り: 全員パスで配り直し待ち');
      check(applyAction(st, { type: 'redeal' }).ok, '配り直し');
      eq([st.phase, st.turn, st.dealer, st.roundNo, st.lastNapoleon], ['BIDDING', s0, (d0 + 1) % 5, 0, null], '配り直し: 開始席維持・ディーラー前進・局数そのまま');
    }
    {
      // ♠20 で即確定
      const st = createGame({ preset: 'standard' }, 'bid-s20');
      const s0 = st.turn;
      applyAction(st, { type: 'bid', seat: s0, suit: 'S', count: 20 });
      eq([st.phase, st.napoleon], ['CALL_ADJUTANT', s0], '競り: ♠20で即確定');
    }
    {
      const st = createGame({ preset: 'standard' }, 'bid-min');
      check(applyAction(st, { type: 'bid', seat: st.turn, suit: 'C', count: 10 }).ok, '競り: 最低10枚');
      const st2 = createGame({ preset: 'standard' }, 'bid-min2');
      check(!applyAction(st2, { type: 'bid', seat: st2.turn, suit: 'S', count: 9 }).ok, '競り: 標準は9を拒否');
    }

    // ---- 3. 合法手
    {
      const lead = (c, req) => [{ seat: 0, card: c }];
      eq(legalPlays(['D3', 'D14', 'S5', 'JK'], lead('D9'), null, STD).sort(), ['D14', 'D3', 'JK'], '合法手: 先手マーク＋ジョーカー');
      eq(legalPlays(['C3', 'S5', 'H2'], lead('D9'), null, STD).sort(), ['C3', 'H2', 'S5'], '合法手: 先手マークなし→何でも');
      eq(legalPlays(['S14', 'D2'], lead('D9'), null, STD), ['D2'], '合法手: マイティもフォロー制約を受ける');
      eq(legalPlays(['S14', 'H2'], lead('S9'), null, STD), ['S14'], '合法手: ♠台札で♠がマイティだけならマイティ');
      // 裏Jの印刷マーク: 切札♠、先手♣、♣Jは♣のフォロー
      eq(legalPlays(['C11', 'S3'], lead('C9'), null, STD), ['C11'], '合法手: 裏J(♣J)は♣としてフォロー');
      eq(legalPlays(['C11', 'S3'], lead('S9'), null, STD), ['S3'], '合法手: 裏J(♣J)は♠のフォローにならない');
      for (const s of Cards.SUITS) {
        const tr = [{ seat: 0, card: 'JK' }];
        const hand = ['S5', 'H5', 'D5', 'C5'];
        eq(legalPlays(hand, tr, s, STD), [s + '5'], '合法手: 先手ジョーカーの要求マーク ' + s);
      }
      // 初巡ジョーカーリード可
      const st = createScenario(STD, { hands: [['JK', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'], ['H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11'],
        ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11'], ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11'], ['S11', 'S12', 'S13', 'S14', 'H12', 'H13', 'H14', 'D12', 'D13', 'D14']],
        discards: ['C12', 'C13', 'C14'], napoleon: 0, trump: 'S', calledCard: 'S14' });
      check(!applyAction(st, { type: 'play', seat: 0, card: 'JK' }).ok, '合法手: 先手ジョーカーはマーク指定が必要');
      check(applyAction(st, { type: 'play', seat: 0, card: 'JK', requestedSuit: 'H' }).ok, '合法手: 初巡のジョーカーリード可');
      check(!applyAction(st, { type: 'play', seat: 1, card: 'H2', requestedSuit: 'S' }).ok || st.requestedSuit === 'H', '合法手: 後続は要求マークを変えられない');
    }
    // ---- 16. ♣3 ジョーカー請求
    {
      const lead = [{ seat: 0, card: 'C3' }];
      eq(legalPlays(['C9', 'JK', 'H2'], lead, null, STD), ['JK'], '請求: ♣を持っていてもジョーカー必須');
      eq(legalPlays(['C9', 'H2'], lead, null, STD), ['C9'], '請求: ジョーカーなしは通常フォロー');
      const mid = [{ seat: 0, card: 'C5' }, { seat: 1, card: 'C3' }];
      eq(legalPlays(['C9', 'JK'], mid, null, STD).sort(), ['C9', 'JK'], '請求: 後続の♣3は請求にならない');
      // 請求者本人がジョーカーを持つ → 後続から出ないだけで止まらない
      const st = createScenario(STD, { hands: [['C3', 'JK', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S2'], ['C4', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11'],
        ['C5', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11'], ['C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C2', 'H2', 'D2', 'S3'], ['S11', 'S12', 'S13', 'S14', 'H12', 'H13', 'H14', 'D12', 'D13', 'D14']],
        discards: ['C12', 'C13', 'C14'], napoleon: 0, trump: 'S', calledCard: 'S14' });
      applyAction(st, { type: 'play', seat: 0, card: 'C3' });
      check(applyAction(st, { type: 'play', seat: 1, card: 'C4' }).ok, '請求: 請求者がジョーカー所持でも進行');
      check(applyAction(st, { type: 'play', seat: 2, card: 'C5' }).ok, '請求: 進行2');
      check(applyAction(st, { type: 'play', seat: 3, card: 'C6' }).ok, '請求: 進行3');
      check(applyAction(st, { type: 'play', seat: 4, card: 'S11' }).ok, '請求: ♣なしは任意');
      eq(st.lastTrick.winnerSeat, 4, '請求: 通常の強さで判定（♠J=切札）');
    }

    // ---- 4. 優先順位（切札4種）
    for (const tr of Cards.SUITS) {
      const L = Cards.LEFT_SUIT[tr];
      const side = Cards.SUITS.find((s) => s !== tr && s !== L && s !== 'S'); // ♠Aが混ざらない台札マーク
      const top = tr === 'S' ? 'S13' : tr + '14'; // マイティ以外の最上位の切札
      const second = tr === 'S' ? 'S12' : tr + '13';
      eq(W([side + '14', 'S14', 'JK', tr + '11', L + '11'], tr), [1, 'MIGHTY'], `優先: マイティ最強（切札${tr}）`);
      eq(W([side + '14', tr + '11', 'JK', L + '11', top], tr), [2, 'JOKER'], `優先: ジョーカー>正J（切札${tr}）`);
      eq(W([side + '14', L + '11', tr + '11', top, side + '13'], tr), [2, 'RIGHT_JACK'], `優先: 正J>裏J（切札${tr}）`);
      eq(W([side + '14', top, L + '11', second, side + '13'], tr), [2, 'LEFT_JACK'], `優先: 裏J>切札A（切札${tr}）`);
      eq(W([side + '14', side + '13', tr + '2', side + '12', side + '10'], tr), [2, 'TRUMP'], `優先: 切札の2>台札A（切札${tr}）`);
      const other = Cards.SUITS.find((s) => s !== tr && s !== side);
      eq(W([side + '5', other + '13', side + '9', other + '12', side + '7'], tr), [2, 'LEAD_SUIT'], `優先: 台札マークの最大（切札${tr}）`);
    }
    // 他マークは勝たない
    eq(W(['D5', 'C14', 'H14', 'D6', 'C13'], 'S'), [3, 'LEAD_SUIT'], '優先: 台札以外の高い札は勝たない');

    // ---- 5. よろめき
    eq(W(['S14', 'H12', 'D2', 'D3', 'D4'], 'D'), [1, 'YOROMEKI'], 'よろめき: ♠A先・♥Q後');
    eq(W(['H12', 'D2', 'S14', 'D3', 'D4'], 'D'), [0, 'YOROMEKI'], 'よろめき: ♥Q先・♠A後');
    eq(W(['H12', 'H2', 'H13', 'H3', 'H4'], 'D', { trickNo: 0 }), [2, 'LEAD_SUIT'], 'よろめき: ♠Aなしの♥Qは普通のQ');
    eq(W(['JK', 'H12', 'S14', 'D3', 'D4'], 'D', { req: 'H' }), [1, 'YOROMEKI'], 'よろめき: 先手ジョーカーと共存');
    eq(W(['S14', 'JK', 'D3', 'D4', 'D5'], 'D'), [0, 'MIGHTY'], 'マイティ>ジョーカー');

    // ---- 17. ジョーカーの強さは先手・後続で同じ
    eq(W(['D5', 'JK', 'S11', 'C11', 'S14'], 'S'), [4, 'MIGHTY'], 'ジョーカー: マイティに負ける');
    eq(W(['D5', 'S11', 'C11', 'S13', 'JK'], 'S'), [4, 'JOKER'], 'ジョーカー: 後続でも正J・裏J・切札に勝つ');
    eq(W(['JK', 'S11', 'C11', 'S13', 'D5'], 'S', { req: 'D' }), [0, 'JOKER'], 'ジョーカー: 先手でも同じ強さ');
    eq(W(['D5', 'JK', 'H12', 'S14', 'D6'], 'S'), [2, 'YOROMEKI'], 'ジョーカー: ♠A＋♥Qならよろめきの♥Q');

    // ---- 6. セイム2
    eq(W(['H5', 'H2', 'H14', 'H9', 'H13'], 'S', { trickNo: 1 }), [1, 'SAME_TWO'], 'セイム2: 2巡目から成立');
    eq(W(['H5', 'H2', 'H14', 'H9', 'H13'], 'S', { trickNo: 0 }), [2, 'LEAD_SUIT'], 'セイム2: 初巡は無効');
    eq(W(['H5', 'H2', 'H14', 'H9', 'D13'], 'C'), [2, 'LEAD_SUIT'], 'セイム2: マーク混在は不成立');
    eq(W(['H5', 'H2', 'H14', 'JK', 'H13'], 'C'), [3, 'JOKER'], 'セイム2: ジョーカー混入は不成立');
    eq(W(['JK', 'H2', 'H14', 'H9', 'H13'], 'C', { req: 'H' }), [0, 'JOKER'], 'セイム2: 先手ジョーカー指定でも不成立');
    eq(W(['S5', 'S2', 'S14', 'S9', 'S13'], 'H'), [2, 'MIGHTY'], 'セイム2: マイティに負ける');
    eq(W(['H5', 'H2', 'H11', 'H9', 'H13'], 'H'), [2, 'RIGHT_JACK'], 'セイム2: 正Jに負ける');
    eq(W(['D5', 'D2', 'D11', 'D9', 'D13'], 'H'), [2, 'LEFT_JACK'], 'セイム2: 裏Jに負ける');
    eq(W(['H5', 'H2', 'H14', 'H9', 'H13'], 'H'), [1, 'SAME_TWO'], 'セイム2: 切札マークでも切札Aに勝つ');
    eq(W(['D5', 'D3', 'D14', 'D9', 'D13'], 'H'), [2, 'LEAD_SUIT'], 'セイム2: 2がなければ不成立');

    // ---- 7. 副官の決定・公開
    const baseHands = () => [
      ['S14', 'S13', 'S12', 'S10', 'S9', 'S8', 'H14', 'D14', 'C14', 'C2'],
      ['JK', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10'],
      ['S11', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'],
      ['C11', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'S2'],
      ['H11', 'H12', 'H13', 'D11', 'D12', 'D13', 'C12', 'C13', 'S3', 'S4'],
    ];
    const toCall = (kitty) => {
      const st = createGame({ preset: 'standard' }, 'call');
      st.hands = baseHands(); st.kitty = kitty;
      st.phase = 'BIDDING'; st.turn = 0; st.currentBid = null; st.passStreak = 0; st.bids = [];
      applyAction(st, { type: 'bid', seat: 0, suit: 'S', count: 14 });
      for (const k of [1, 2, 3, 4]) applyAction(st, { type: 'pass', seat: k });
      return st;
    };
    {
      const st = toCall(['S5', 'S6', 'S7']);
      applyAction(st, { type: 'call', seat: 0, card: 'JK' });
      eq([st.adjutant, st.solo], [1, false], '副官: 他席が持っていればその人');
      const o1 = getObservation(st, 1), o2 = getObservation(st, 2), o0 = getObservation(st, 0);
      eq([o1.role, o1.adjutantSeat], ['adjutant', 1], '副官: 本人は知る');
      eq([o2.role, o2.adjutantSeat], ['allied', null], '副官: 他席には非公開');
      eq(o0.adjutantSeat, null, '副官: ナポレオンにも非公開');
      eq(st.hands[0].length, 13, '交換: ナポレオンは13枚');
      check(!applyAction(st, { type: 'exchange', seat: 0, discards: ['S5', 'S6'] }).ok, '交換: 3枚以外は拒否');
      check(!applyAction(st, { type: 'exchange', seat: 0, discards: ['S5', 'S6', 'H2'] }).ok, '交換: 持っていない札は拒否');
      check(applyAction(st, { type: 'exchange', seat: 0, discards: ['C14', 'C2', 'S5'] }).ok, '交換: 3枚捨て');
      eq(st.hands.reduce((n, h) => n + h.length, 0) + st.discards.length, 53, '交換後: 手札50＋捨て札3');
      eq(getObservation(st, 2).publicDiscards, ['C14'], '交換: 得点札は公開');
      eq(getObservation(st, 2).hiddenDiscardCount, 2, '交換: 非得点札は枚数だけ');
      eq(getObservation(st, 2).myDiscards, null, '交換: 他席は非公開捨て札を知らない');
      eq(NP.pointConservation(st), 20, '交換後: 得点札20枚');
      // 指定札が出たら公開
      st.trickNo = 0; st.leader = 1; st.turn = 1;
      applyAction(st, { type: 'play', seat: 1, card: 'JK', requestedSuit: 'D' });
      eq(getObservation(st, 3).adjutantSeat, 1, '副官: 指定札が出たら公開');
    }
    {
      const st = toCall(['S5', 'S6', 'S7']);
      applyAction(st, { type: 'call', seat: 0, card: 'H14' });
      eq([st.solo, st.soloReason, st.napoleonKnowsSolo], [true, 'self', true], '単独戦: 自分の札を指定');
      eq(getObservation(st, 1).solo, null, '単独戦: 他席には未公開');
    }
    {
      const st = toCall(['S5', 'S6', 'S7']);
      st.hands[0] = st.hands[0].filter((c) => c !== 'D14'); st.hands[0].push('S7'); st.kitty = ['S5', 'S6', 'D14'];
      applyAction(st, { type: 'call', seat: 0, card: 'D14' });
      eq([st.solo, st.soloReason], [true, 'kitty'], '単独戦: 交換札にあった');
      eq(getObservation(st, 0).solo, true, '単独戦: ナポレオンは交換札取得時に知る');
      eq(getObservation(st, 2).solo, null, '単独戦: 他席は知らない');
      applyAction(st, { type: 'exchange', seat: 0, discards: ['D14', 'S5', 'S6'] });
      eq([st.soloRevealed, getObservation(st, 2).solo], [true, true], '単独戦: 指定札(得点札)を捨てたら公開');
    }
    {
      const st = toCall(['S5', 'S6', 'S7']);
      applyAction(st, { type: 'call', seat: 0, card: 'C2' });
      applyAction(st, { type: 'exchange', seat: 0, discards: ['C2', 'S5', 'S6'] });
      eq([st.solo, st.soloRevealed, getObservation(st, 3).solo], [true, false, null], '単独戦: 非得点の指定札を捨てたら局終了まで非公開');
    }

    // ---- 8, 9, 18. 得点の帰属・捨て札・保存
    const playAll = (st, chooser) => {
      let guard = 0;
      while (st.phase === 'PLAY' || st.phase === 'TRICK_RESULT') {
        if (++guard > 200) break;
        if (st.phase === 'TRICK_RESULT') { applyAction(st, { type: 'collect' }); continue; }
        const acts = NP.getLegalActions(st, st.turn);
        const a = chooser ? chooser(st, acts) : acts[0];
        const r = applyAction(st, a);
        if (!r.ok) { check(false, 'playAll: ' + r.error); break; }
      }
    };
    {
      // 初巡の勝者が捨てた得点札を取る（副官 / ナポレオン / 連合軍）
      for (const [winnerSeat, label] of [[0, 'ナポレオン'], [1, '副官'], [2, '連合軍']]) {
        const hands = [
          ['D2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'H2'],
          ['D3', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'JK'],
          ['D4', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12'],
          ['D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14'],
          ['S2', 'S11', 'S12', 'S13', 'S14', 'H11', 'H12', 'H13', 'H14', 'C2'],
        ];
        // 勝者を作るためにその席に♦Aを持たせる
        const holder = 3;
        if (winnerSeat !== holder) { const i = hands[holder].indexOf('D14'); const j = hands[winnerSeat].indexOf('D' + (2 + winnerSeat)); [hands[holder][i], hands[winnerSeat][j]] = [hands[winnerSeat][j], hands[holder][i]]; }
        const st = createScenario(STD, { hands, discards: ['C13', 'C14', 'C3'], napoleon: 0, trump: 'H', calledCard: 'JK', target: 13 });
        eq(st.adjutant, 1, '帰属: 副官は1');
        const firstPlays = hands.map((h) => h.find((c) => c[0] === 'D'));
        firstPlays[4] = 'C2'; // ♦なし
        for (let s = 0; s < 5; s++) applyAction(st, { type: 'play', seat: s, card: firstPlays[s] });
        eq(st.lastTrick.winnerSeat, winnerSeat, '帰属: 初巡勝者 ' + label);
        eq([st.lastTrick.discardPointCount], [2], '帰属: 捨てた得点札は2枚');
        applyAction(st, { type: 'collect' });
        check(st.wonCards[winnerSeat].includes('C14') && st.wonCards[winnerSeat].includes('C13'), `帰属: 捨てた得点札は初巡勝者(${label})へ`);
        eq(st.adjutant, 1, '帰属: 回収で役職は変わらない');
        const before = st.wonCards[winnerSeat].length;
        playAll(st);
        eq(st.phase, 'ROUND_RESULT', '帰属: 10巡で終了');
        eq(st.wonCards.reduce((n, w) => n + w.length, 0), 20, '保存: 終了時20枚');
        eq(st.result.napCount + st.result.alliedCount, 20, '保存: 軍合計20枚');
        check(st.wonCards[winnerSeat].length >= before, '帰属: 二重取得なし');
        eq(st.wonCards.flat().filter((c) => c === 'C14').length, 1, '帰属: 捨て札の二重加算なし');
      }
    }
    {
      // 副官が公開前に取った分も軍合計に入る
      const st = createScenario(STD, { hands: baseHands(), discards: ['S5', 'S6', 'S7'], napoleon: 0, trump: 'S', calledCard: 'C11' });
      st.leader = 1; st.turn = 1; st.trickNo = 1; st.discardsCollected = true;
      // 1が♥を出し、3は♥なし→切札♠2で取る（副官3が公開前に取る）
      applyAction(st, { type: 'play', seat: 1, card: 'H10' });
      applyAction(st, { type: 'play', seat: 2, card: 'D10' });
      applyAction(st, { type: 'play', seat: 3, card: 'S2' });
      applyAction(st, { type: 'play', seat: 4, card: 'H13' });
      applyAction(st, { type: 'play', seat: 0, card: 'H14' });
      eq(st.lastTrick.winnerSeat, 3, '副官: 公開前に取る');
      applyAction(st, { type: 'collect' });
      const o = getObservation(st, 2);
      eq(NP.publicTally(o).mode, 'split', '集計: 公開前は軍別合計を出さない');
      playAll(st);
      eq(st.result.adjutant, 3, '副官: 局終了で確定');
      eq(st.result.napCount, st.wonCards[0].length + st.wonCards[3].length, '副官: 公開前の分も軍合計に入る');
    }

    // ---- 9. 得点表
    const R = (o) => scoreRound({ napoleon: 0, adjutant: o.solo ? null : 1, ...o });
    eq(R({ success: true, solo: false, napCount: 15 }), { row: 'TEAM_WIN', pts: [4, 2, 0, 0, 0] }, '得点: 通常勝利');
    eq(R({ success: false, solo: false, napCount: 10 }), { row: 'TEAM_LOSE', pts: [0, 0, 2, 2, 2] }, '得点: 連合軍勝利');
    eq(R({ success: true, solo: true, napCount: 15 }), { row: 'SOLO_WIN', pts: [6, 0, 0, 0, 0] }, '得点: 単独勝利');
    eq(R({ success: true, solo: false, napCount: 20 }), { row: 'TEAM_20', pts: [6, 4, 0, 0, 0] }, '得点: 20枚（上乗せなし）');
    eq(R({ success: true, solo: true, napCount: 20 }), { row: 'SOLO_20', pts: [10, 0, 0, 0, 0] }, '得点: 単独20枚');
    eq(R({ success: false, solo: true, napCount: 3 }), { row: 'SOLO_LOSE', pts: [0, 1, 1, 1, 1] }, '得点: 単独の連合軍勝利');

    // ---- 19. 2局目は前局ナポレオンから
    {
      const st = createGame({ preset: 'standard', rounds: 5 }, 'r2');
      const s0 = st.turn;
      applyAction(st, { type: 'bid', seat: s0, suit: 'S', count: 13 });
      const nap = s0;
      for (const k of [1, 2, 3, 4]) applyAction(st, { type: 'pass', seat: (s0 + k) % 5 });
      applyAction(st, { type: 'call', seat: nap, card: 'JK' });
      applyAction(st, { type: 'exchange', seat: nap, discards: st.hands[nap].slice(0, 3) });
      playAll(st);
      const d = st.dealer;
      applyAction(st, { type: 'next' });
      eq([st.phase, st.turn, st.dealer], ['BIDDING', nap, (d + 1) % 5], '2局目: 前局ナポレオンから・ディーラー前進');
      // 配り直しでは前局ナポレオン・局数を更新しない
      for (let k = 0; k < 5; k++) applyAction(st, { type: 'pass', seat: (nap + k) % 5 });
      applyAction(st, { type: 'redeal' });
      eq([st.turn, st.roundNo, st.lastNapoleon], [nap, 1, nap], '配り直し: 前局ナポレオン・局数を維持');
    }
    // 不正操作の再検証
    {
      const st = createGame({ preset: 'standard' }, 'guard');
      check(!applyAction(st, { type: 'pass', seat: (st.turn + 1) % 5 }).ok, '検証: 手番外は拒否');
      check(!applyAction(st, { type: 'play', seat: st.turn, card: st.hands[st.turn][0] }).ok, '検証: フェーズ違いは拒否');
      check(!applyAction(st, { type: 'pass', seat: st.turn, actionId: st.actionId + 5 }).ok, '検証: 古い操作IDは拒否');
    }

    out(`${fail ? 'NG' : 'OK'}  pass ${pass} / fail ${fail}`);
    return { pass, fail };
  }
  NP.runRuleTests = run;
})(typeof window !== 'undefined' ? window : globalThis);
