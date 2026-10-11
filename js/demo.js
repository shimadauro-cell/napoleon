// 観戦（CPU 5人）。席0もCPU。「全手札を公開」は画面だけの機能で、CPUの判断は通常と同じ観測情報だけ。
'use strict';
(function () {
  const NP = window.NP;
  let count = 0;
  function start({ cfg }) {
    const UI = NP.UI;
    const seed = (/[?&]seed=([^&]+)/.exec(location.search) || [])[1] || 'demo-' + Date.now() + '-' + count++;
    UI.startSession({
      mode: 'demo', human: null, cfg: { ...cfg, rounds: 5 }, seed, recordStats: false, onExit: UI.showTitle,
      hooks: {
        // マッチが終わったら少し待って次のマッチへ（タイトルへ戻ればタイマーは解除される）
        onMatchEnd() { UI.later(() => { UI.closeModal(); start({ cfg }); }, 7000); },
      },
    });
  }
  NP.Demo = { start };
})();
