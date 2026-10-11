// チュートリアルの固定場面で、台本が想定した勝者・勝因と、エンジンの実際の結果が一致するか（node tests/tutorial.js）
'use strict';
const path = require('path');
for (const f of ['engine.js', 'ai.js', 'tutorial.js']) require(path.join(__dirname, '..', 'js', f));
const NP = globalThis.NP;
let fails = 0, checks = 0;
for (const L of NP.Tutorial.LESSONS) {
  const r = NP.Tutorial.simulate(L);
  const want = L.scenes.flatMap((s) => s.steps.filter((x) => x.expect)).length;
  checks += r.results.length;
  if (r.errors.length || r.results.length !== want) { fails++; console.log(`FAIL ${L.title}: ${r.errors.join(' / ') || `巡の数 ${r.results.length}/${want}`}`); }
  else console.log(`ok   ${L.title}: ${r.results.map((x) => `${x.winner}:${x.reason}`).join(', ')}`);
}
console.log(fails ? `NG ${fails}` : `OK  ${checks}巡の勝者・勝因が台本と一致`);
process.exit(fails ? 1 : 0);
