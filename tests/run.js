// ルールテスト（node tests/run.js）
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'js', 'engine.js'));
require(path.join(__dirname, '..', 'js', 'tests.js'));
const r = globalThis.NP.runRuleTests(console.log);
process.exit(r.fail ? 1 : 0);
