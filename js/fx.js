// 演出（大きな文字・カットイン・紙吹雪・フラッシュ・揺れ）。座標はステージ（1920×1080）基準。
// 「動きを減らす」設定では揺れ・フラッシュ・紙吹雪を止め、文字だけを短く出す。
'use strict';
(function () {
  const NP = window.NP;
  const COLORS = ['#ffd23f', '#ff3fa4', '#22c7ff', '#8a4dff', '#2fe39a', '#ffffff', '#ff9a2e'];
  // 演出用の見た目だけの乱数（ゲームの乱数は使わない）
  let seed = 7;
  const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + ((seed % 10000) / 10000) * (b - a); };
  const layer = () => document.getElementById('fx-layer');
  const speed = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--speed')) || 1;
  const reduced = () => document.documentElement.classList.contains('reduce-motion');
  const spawn = (html) => { const d = document.createElement('div'); d.innerHTML = html; const n = d.firstElementChild; layer().appendChild(n); return n; };
  const anim = (node, keyframes, ms, easing = 'cubic-bezier(.2,.7,.3,1)') => {
    const a = node.animate(keyframes, { duration: ms / speed(), easing, fill: 'forwards' });
    a.onfinish = () => node.remove();
    return a;
  };

  NP.Fx = {
    clear() { const l = layer(); if (l) l.innerHTML = ''; },
    shake(power = 10, ms = 380) {
      if (reduced()) return;
      const e = document.getElementById('game');
      const k = [];
      for (let i = 0; i < 8; i++) { const p = power * (1 - i / 8); k.push({ transform: `translate(${rnd(-p, p)}px, ${rnd(-p, p)}px)` }); }
      k.push({ transform: 'none' });
      e.animate(k, { duration: ms / speed() });
    },
    flash(color = '#fff', opacity = 0.6, ms = 360) {
      if (reduced()) return;
      const n = spawn('<div class="fx-flash"></div>');
      n.style.background = color;
      anim(n, [{ opacity }, { opacity: 0 }], ms, 'ease-out');
    },
    confetti(x = 960, y = 420, n = 60) {
      if (reduced()) return;
      for (let i = 0; i < n; i++) {
        const c = spawn('<div class="confetti"></div>');
        c.style.left = x + 'px'; c.style.top = y + 'px';
        c.style.background = COLORS[i % COLORS.length];
        const a = rnd(0, Math.PI * 2), v = rnd(250, 700);
        const dx = Math.cos(a) * v, dy = Math.sin(a) * v - 250, r = rnd(-720, 720);
        anim(c, [
          { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) rotate(${r / 2}deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy + 600}px) rotate(${r}deg)`, opacity: 0 },
        ], rnd(1200, 1800));
      }
    },
    // 中央の大きな文字（「副官判明！」など）。sub は小さな説明
    bigText(text, { color = '#ffd23f', sub = '', ms = 1300, y = 430 } = {}) {
      const n = spawn(`<div class="fx-big"><div class="fx-big-main"></div><div class="fx-big-sub"></div></div>`);
      n.querySelector('.fx-big-main').textContent = text;
      n.querySelector('.fx-big-sub').textContent = sub;
      n.style.top = y + 'px';
      n.querySelector('.fx-big-main').style.color = color;
      if (reduced()) anim(n, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], ms);
      else anim(n, [
        { transform: 'translate(-50%, -50%) scale(2.2)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.85 },
        { transform: 'translate(-50%, -50%) scale(.9)', opacity: 0 },
      ], ms);
    },
    // カットイン（キャラ＋文字）
    // 自分の番の告知（細い斜め帯＋「YOUR TURN」）
    yourTurn(sub = '') {
      document.querySelectorAll('#fx-layer .fx-turn').forEach((x) => x.remove());
      const n = spawn('<div class="fx-turn"><div class="yt-band"></div><div class="yt-main">YOUR TURN</div><div class="yt-sub"></div></div>');
      n.querySelector('.yt-sub').textContent = sub;
      const ms = 1300;
      if (reduced()) { anim(n, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], ms); return; }
      const D = ms / speed();
      n.querySelector('.yt-band').animate([{ transform: 'skewY(-4deg) scaleX(0)' }, { transform: 'skewY(-4deg) scaleX(1)', offset: 0.15 }, { transform: 'skewY(-4deg) scaleX(1)', offset: 0.8 }, { transform: 'skewY(-4deg) scaleX(0)', transformOrigin: 'right' }], { duration: D, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      n.querySelector('.yt-main').animate([{ transform: 'translate(-50%, -50%) translateX(-500px) skewX(-15deg)', opacity: 0 }, { transform: 'translate(-50%, -50%) translateX(0) skewX(-10deg)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%, -50%) translateX(30px) skewX(-10deg)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%, -50%) translateX(500px) skewX(-15deg)', opacity: 0 }], { duration: D, easing: 'ease-out', fill: 'forwards' });
      anim(n, [{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], ms, 'linear');
    },
    // 斜めの帯・集中線・キャラが滑り込み、文字が逆方向から刺さる。win=true は勝利版（金色・紙吹雪・長め）
    // opts: sub（小さい説明）, card（札のHTML）, name（出した人）, mood, color, color2, ms, win
    cutin(charId, text, { sub = '', card = '', name = '', mood = '', color = '#ff3fa4', color2 = '#8a4dff', ms = 1500, win = false, lose = false } = {}) {
      document.querySelectorAll('#fx-layer .fx-cutin').forEach((x) => x.remove()); // 重ならないよう前のカットインを消す
      const n = spawn(`<div class="fx-cutin${win ? ' win' : ''}${lose ? ' lose' : ''}" style="--c:${color};--c2:${color2}">
        <div class="ci-dim"></div>
        <div class="ci-band"><div class="ci-lines"></div><div class="ci-edge top"></div><div class="ci-edge bottom"></div></div>
        <div class="ci-char">${NP.Art.cutin(charId, mood)}</div>
        <div class="ci-text"><div class="ci-name"></div><div class="ci-main"></div><div class="ci-sub"></div></div>
        ${card ? `<div class="ci-card">${card}</div>` : ''}
        <div class="ci-flash"></div></div>`);
      n.querySelector('.ci-main').textContent = text;
      // 見た目の幅（英数字は全角の約0.6文字分）で文字の大きさを決める
      const w = [...text].reduce((a, ch) => a + (ch.charCodeAt(0) < 256 ? 0.6 : 1), 0);
      const mainEl = n.querySelector('.ci-main');
      if (w >= 10.5) mainEl.classList.add('xxlong');
      else if (w >= 9) mainEl.classList.add('xlong');
      else if (w >= 6) mainEl.classList.add('long');
      n.querySelector('.ci-sub').textContent = sub;
      n.querySelector('.ci-name').textContent = name;
      const sp = speed();
      const D = ms / sp;
      if (reduced()) { anim(n, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], ms); return; }
      const opt = (easing = 'cubic-bezier(.15,.9,.25,1)') => ({ duration: D, easing, fill: 'forwards' });
      n.querySelector('.ci-band').animate([
        { transform: 'skewY(-7deg) scaleY(0)' }, { transform: 'skewY(-7deg) scaleY(1.15)', offset: 0.08 }, { transform: 'skewY(-7deg) scaleY(1)', offset: 0.13 },
        { transform: 'skewY(-7deg) scaleY(1)', offset: 0.86 }, { transform: 'skewY(-7deg) scaleY(0)' }], opt('linear'));
      n.querySelector('.ci-dim').animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], opt('linear'));
      n.querySelector('.ci-char').animate([
        { transform: 'translateX(-700px) skewX(-12deg)', opacity: 0 }, { transform: 'translateX(20px) skewX(0)', opacity: 1, offset: 0.14 },
        { transform: 'translateX(60px)', opacity: 1, offset: 0.84 }, { transform: 'translateX(-200px)', opacity: 0 }], opt('ease-out'));
      n.querySelector('.ci-text').animate([
        { transform: 'translateX(900px) skewX(-18deg)', opacity: 0 }, { transform: 'translateX(-20px) skewX(-8deg)', opacity: 1, offset: 0.16 },
        { transform: 'translateX(0) skewX(-8deg)', opacity: 1, offset: 0.2 }, { transform: 'translateX(-40px) skewX(-8deg)', opacity: 1, offset: 0.84 },
        { transform: 'translateX(400px) skewX(-18deg)', opacity: 0 }], opt('ease-out'));
      const cardEl = n.querySelector('.ci-card');
      if (cardEl) cardEl.animate([
        { transform: 'translate(-50%, -50%) scale(2.6) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(.9) rotate(8deg)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(6deg)', opacity: 1, offset: 0.24 }, { transform: 'translate(-50%, -50%) scale(1.05) rotate(4deg)', opacity: 1, offset: 0.84 },
        { transform: 'translate(-50%, -50%) scale(.6) rotate(0deg)', opacity: 0 }], opt('ease-out'));
      n.querySelector('.ci-flash').animate([{ opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 0.85, offset: 0.14 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], opt('linear'));
      const a = n.animate([{ opacity: 1 }, { opacity: 1 }], { duration: D, fill: 'forwards' });
      a.onfinish = () => n.remove();
      setTimeout(() => { if (lose) return; this.shake(win ? 16 : 10, 360); if (win) this.confetti(960, 450, 70); }, D * 0.14); // 敗北版は揺らさない
    },
  };
})();
