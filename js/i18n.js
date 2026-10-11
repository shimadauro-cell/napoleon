// 言語（日本語 / 英語）。タイトル画面で切り替え、ページを読み直して反映する（ゲーム中は変えない）。
// 使い方: NP.L('日本語', 'English') … 今の言語の文字を返す
'use strict';
(function (root) {
  const NP = (root.NP = root.NP || {});
  let lang = 'ja';
  try {
    const v = root.localStorage && root.localStorage.getItem('np.v1.lang');
    if (v) lang = JSON.parse(v) === 'en' ? 'en' : 'ja';
    const m = root.location && /[?&]lang=(ja|en)/.exec(root.location.search);
    if (m) lang = m[1];
  } catch (e) { /* noop */ }
  NP.lang = lang;
  NP.L = (ja, en) => (lang === 'en' && en != null ? en : ja);
  NP.setLang = (l) => {
    try { root.localStorage.setItem('np.v1.lang', JSON.stringify(l === 'en' ? 'en' : 'ja')); } catch (e) { /* noop */ }
    if (root.location) {
      // URL に ?lang= が付いていれば外してから読み直す
      const u = root.location.href.replace(/([?&])lang=(ja|en)&?/, '$1').replace(/[?&]$/, '');
      root.location.replace(u);
    }
  };
  if (root.document) root.document.documentElement.lang = lang;
})(typeof window !== 'undefined' ? window : globalThis);
