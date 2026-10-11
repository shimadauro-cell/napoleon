// 不具合の再現テスト（node tests/regression.js）
'use strict';
const path = require('path');
for (const f of ['engine.js', 'ai.js', 'advisor.js']) require(path.join(__dirname, '..', 'js', f));
const NP = globalThis.NP;
let fails = 0;
const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };

// ---- ヒント：残り手札がすべて台札マーク（＋ジョーカー）でも「持っていない」と言わない
{
  const st = NP.createScenario({}, {
    hands: [['S2', 'S3', 'JK'], ['S5', 'H2', 'H3'], ['D2', 'D3', 'D4'], ['C2', 'C4', 'C5'], ['H4', 'H5', 'S13']],
    napoleon: 1, trump: 'H', calledCard: 'S13', target: 13, leader: 1, trickNo: 3,
  });
  NP.applyAction(st, { type: 'play', seat: 1, card: 'S5' });
  for (const s of [2, 3, 4]) NP.applyAction(st, NP.getLegalActions(st, s)[0]);
  const o = NP.getObservation(st, 0);
  check(o.legal.length === 3, '前提: 手札3枚すべて合法（♠2・♠3・JK）');
  const h = NP.Advisor.hint(o, ['あなた', 'クロウ', 'ミラ', 'レン', 'ルナ']);
  check(/♠を持っているので/.test(h.text) && !/持っていないので/.test(h.text), 'ヒント: ♠を持っているので、と説明する → ' + h.text.slice(0, 40));
}
// ---- ヒント：本当に台札マークが無いときは「持っていない」と説明する
{
  const st = NP.createScenario({}, {
    hands: [['H6', 'D7', 'C8'], ['S5', 'H2', 'H3'], ['D2', 'D3', 'D4'], ['C2', 'C4', 'C5'], ['H4', 'H5', 'S13']],
    napoleon: 1, trump: 'H', calledCard: 'S13', target: 13, leader: 1, trickNo: 3,
  });
  NP.applyAction(st, { type: 'play', seat: 1, card: 'S5' });
  for (const s of [2, 3, 4]) NP.applyAction(st, NP.getLegalActions(st, s)[0]);
  const h = NP.Advisor.hint(NP.getObservation(st, 0), ['あなた', 'クロウ', 'ミラ', 'レン', 'ルナ']);
  check(/♠を持っていないので/.test(h.text), 'ヒント: ♠が無ければ、持っていないので、と説明する');
}

console.log(fails ? `NG ${fails}` : 'OK');
process.exit(fails ? 1 : 0);
