// チュートリアル。各レッスンは「説明 → 固定配札で2〜3回操作 → 確認」。
// 固定場面でも通常のエンジンで判定し、結果の説明はエンジンの勝因（explainWin）から作る（演出で偽装しない）。
// NP.Tutorial.simulate(lesson) は DOM なしで台本を最後まで実行し、想定した勝者と実際の勝者の一致を確かめる（tests/tutorial.js）。
'use strict';
(function (root) {
  const NP = root.NP;
  const T = NP.L || ((ja) => ja); // 言語（Node のテストでは日本語）
  const N = [T('あなた', 'You'), T('クロウ', 'Crow'), T('ミラ', 'Mira'), T('レン', 'Ren'), T('ルナ', 'Luna')];
  const why = (st) => NP.explainWin(st.lastTrick, N, st.trump);
  // 英文の末尾の句読点が重ならないように（説明文が ! で終わる場合など）
  const dot = (s, p = '.') => (/[.!?]$/.test(s) ? s : s + p);
  const ptsOf = (st) => st.lastTrick.playedPointCount + st.lastTrick.discardPointCount;

  const STD = { preset: 'standard' };
  const LESSONS = [
    {
      id: 'points', title: T('1. 得点札を集める', '1. Collect Point Cards'), desc: T('A・K・Q・J・10 の枚数を集めるゲーム', 'A game of collecting A, K, Q, J and 10s'),
      scenes: [{
        cfg: STD,
        scenario: { hands: [['D14', 'H5', 'C5'], ['D10', 'H9', 'C7'], ['D3', 'H8', 'S5'], ['D13', 'H6', 'C8'], ['D6', 'H4', 'S13']],
          napoleon: 2, trump: 'S', calledCard: 'S13', target: 13, leader: 0, trickNo: 1 },
        cpu: { 1: ['D10', 'H9'], 2: ['D3', 'H8'], 3: ['D13', 'H6'], 4: ['D6', 'H4'] },
        steps: [
          { say: T('ようこそ！ ナポレオンは5人で遊ぶトランプです。<br>集めるのは<b>得点札</b>：各マークの <b>A・K・Q・J・10</b>（全部で20枚）。札の右上の「得」が目印です。', 'Welcome! Napoleon is a card game for 5 players.<br>You collect <b>point cards</b>: the <b>A, K, Q, J and 10</b> of each suit (20 in all). Look for the "P" badge in the corner.') },
          { say: T('1巡（ひと勝負）では全員が1枚ずつ出し、いちばん強い札を出した人が5枚をまとめて取ります。<br>練習なので手札は少なめです。', 'In each trick, everyone plays one card. The player who plays the strongest card takes all five cards.<br>For this lesson, each player starts with fewer cards.') },
          { game: true, text: T('あなたが先手です。<b>♦A</b>を選んで「出す」（またはもう一度クリック）してみましょう。', 'You lead. Select the <b>♦A</b> and press Play (or click it again).'), allow: ['D14'], until: 'trick', expect: { winner: 0, reason: 'LEAD_SUIT' } },
          { say: (st) => T(`${why(st)}。<br>この巡には得点札が<b>${ptsOf(st)}枚</b>（♦A・♦K・♦10）。あなたの「獲得」が${ptsOf(st)}枚になります。`, `${dot(why(st))}<br>This trick held <b>${ptsOf(st)} point cards</b> (♦A, ♦K, ♦10). Your "Won" count is now ${ptsOf(st)}.`) },
          { game: true, text: T('次の巡もあなたが先手です。<b>♥5</b>を出してみましょう。', 'You lead again. Try playing the <b>♥5</b>.'), allow: ['H5'], until: 'trick', expect: { winner: 1, reason: 'LEAD_SUIT' } },
          { say: (st) => T(`${why(st)}。<br>でも得点札は<b>${ptsOf(st)}枚</b>。強い札で勝っても、得点札がなければ0枚です。<b>数字の大きさではなく、得点札の枚数</b>が目標です。`, `${dot(why(st))}<br>But it held <b>${ptsOf(st)} point cards</b>. Winning a trick with no point cards scores nothing. <b>Count point cards, not high numbers.</b>`) },
        ],
      }],
    },
    {
      id: 'follow', title: T('2. 同じマークを出す', '2. Follow Suit'), desc: T('台札と同じマークがあれば、それを出す', 'If you have the lead suit, you must play it'),
      scenes: [{
        cfg: STD,
        scenario: { hands: [['D4', 'D12', 'H14', 'H3'], ['D14', 'C9', 'S3'], ['D5', 'C4', 'S4'], ['D7', 'C13', 'S12'], ['D9', 'C2', 'S6']],
          napoleon: 1, trump: 'S', calledCard: 'S12', target: 13, leader: 4, trickNo: 1 },
        cpu: { 1: ['D14', 'C9'], 2: ['D5', 'C4'], 3: ['D7', 'C13'], 4: ['D9', 'C2'] },
        steps: [
          { say: T('先手が出した札を<b>台札</b>と呼びます。後の人は、台札と<b>同じマークを持っていれば必ずそれを出します</b>。', 'The first card of a trick is the <b>lead</b>. Everyone after <b>must play the same suit if they have it</b>.') },
          { game: true, text: T('ルナが♦9を出しました。あなたは♦を持っているので♦から選びます。暗い♥Aを押すと理由が出ます。<b>♦4</b>を出しましょう（♦Qは温存）。', 'Luna led ♦9. You have diamonds, so you must pick one. Click the dimmed ♥A to see why. Play the <b>♦4</b> (save the ♦Q).'), allow: ['D4'], until: 'trick', expect: { winner: 1, reason: 'LEAD_SUIT' } },
          { say: (st) => T(`${why(st)}。<br>暗くなっている札は今は出せない札です。押すと理由を読めます。`, `${dot(why(st))}<br>Dimmed cards cannot be played right now. Click one to read why.`) },
          { game: true, text: T('今度はクロウが♣を出します。あなたは♣を持っていないので<b>どの札でも出せます</b>。得点札を渡さないよう<b>♥3</b>を出しましょう。', 'Now Crow leads a club. You have no clubs, so <b>any card is allowed</b>. Play the <b>♥3</b> so you do not give away points.'), allow: ['H3'], until: 'trick', expect: { winner: 3, reason: 'LEAD_SUIT' } },
          { say: (st) => T(`${why(st)}。<br>台札と違うマークの札（切札を除く）は、どんなに大きくても勝てません。持っていない時は弱い札を出すのが基本です。`, `${dot(why(st))}<br>A card of another suit (except trump) can never win, however high. When you cannot follow, play low.`) },
        ],
      }],
    },
    {
      id: 'trump', title: T('3. 切札', '3. Trump'), desc: T('切札は小さい数でも別マークのAに勝つ', 'Even a low trump beats an Ace of another suit'),
      scenes: [{
        cfg: STD,
        scenario: { hands: [['H3', 'C5', 'S7'], ['D14', 'C9', 'S3'], ['D10', 'C4', 'S4'], ['D13', 'C13', 'S5'], ['D5', 'H13', 'S6']],
          napoleon: 2, trump: 'H', calledCard: 'H13', target: 13, leader: 1, trickNo: 1 },
        cpu: { 1: ['D14', 'C9'], 2: ['D10', 'C4'], 3: ['D13', 'C13'], 4: ['D5', 'H13'] },
        steps: [
          { say: T('ナポレオンが決めたマークが<b>切札</b>です。この局の切札は<span class="sym red">♥</span>（画面上の「切札」）。<br>台札のマークを持っていない時、切札を出すと<b>台札のAにも勝てます</b>。', 'The suit Napoleon chose is <b>trump</b>. This round, trump is <span class="sym red">♥</span> (see "Trump" at the top).<br>When you cannot follow suit, a trump <b>beats even the lead Ace</b>.') },
          { game: true, text: T('クロウが♦Aを出しました。あなたは♦を持っていません。切札の<b>♥3</b>で取ってみましょう。', 'Crow led the ♦A. You have no diamonds. Take it with the trump <b>♥3</b>.'), allow: ['H3'], until: 'trick', expect: { winner: 0, reason: 'TRUMP' } },
          { say: (st) => T(`${why(st)}。得点札${ptsOf(st)}枚を獲得！<br>切札の3が、♦Aより強かったのです。`, `${dot(why(st))} You won ${ptsOf(st)} point cards!<br>A trump 3 beat the ♦A.`) },
          { game: true, text: T('今度はあなたが先手。<b>♣5</b>を出してみましょう。', 'Now you lead. Try the <b>♣5</b>.'), allow: ['C5'], until: 'trick', expect: { winner: 4, reason: 'TRUMP' } },
          { say: (st) => T(`${why(st)}。<br>♣を持っていなかったルナが切札♥で取りました。どのマークが誰に「切れている」か覚えておくと有利です。`, `${dot(why(st))}<br>Luna had no clubs and trumped with ♥. Remembering who is out of which suit pays off.`) },
        ],
      }],
    },
    {
      id: 'bid', title: T('4. 宣言と交換', '4. Bidding and Exchange'), desc: T('ナポレオンになって3枚交換', 'Become Napoleon and swap 3 cards'),
      scenes: [{
        cfg: STD,
        scenario: { phase: 'BIDDING', turn: 0, deal: true,
          hands: [['S14', 'S13', 'S12', 'S11', 'S10', 'S9', 'JK', 'H14', 'D3', 'C4'],
            ['H2', 'H3', 'H4', 'H5', 'H6', 'D4', 'D5', 'D6', 'C5', 'C6'],
            ['H7', 'H8', 'H9', 'H10', 'D7', 'D8', 'D9', 'C7', 'C8', 'S2'],
            ['H11', 'H12', 'H13', 'D10', 'D11', 'D12', 'C9', 'C10', 'S3', 'S4'],
            ['D13', 'D14', 'C11', 'C12', 'C13', 'S5', 'S6', 'S7', 'S8', 'C3']],
          kitty: ['C14', 'D2', 'C2'] },
        cpu: {},
        steps: [
          { say: T('まずは<b>競り</b>。「マーク＋枚数」で立候補します。宣言した枚数は、あなた（ナポレオン）と秘密の副官の2人で取る得点札の目標です。', 'First, <b>bidding</b>. You bid a suit and a number. The number is how many point cards you (Napoleon) and your secret adjutant aim to take together.') },
          { say: T('あなたの手札は♠がたくさん。♠を切札にすると強そうです。<br>宣言は最低10枚からです。', 'You have lots of spades. Spades as trump looks strong.<br>The minimum bid is 10.') },
          { game: true, text: T('♠を選び、枚数を決めて「宣言」しましょう（13枚がおすすめ）。', 'Choose ♠, set the number and press Bid (13 is a good choice).'), sim: { type: 'bid', seat: 0, suit: 'S', count: 13 }, deny: (a) => (a.type === 'pass' ? T('このレッスンでは宣言してみましょう（♠がおすすめ）', 'In this lesson, try making a bid (♠ recommended)') : null), until: (st) => st.phase === 'CALL_ADJUTANT' },
          { say: (st) => T(`ほかの4人がパスしたので、あなたが<b>ナポレオン</b>（切札${NP.Cards.SUIT_SYM[st.trump]}・目標${st.target}枚）！<br>次に<b>副官</b>を決める札を指定します（詳しくはレッスン5）。ここでは自分が持っていない<b>♦A</b>がおすすめ。`, `The other four passed, so you are <b>Napoleon</b> (trump ${NP.Cards.SUIT_SYM[st.trump]}, target ${st.target})!<br>Next, call the card that decides your <b>adjutant</b> (more in Lesson 5). The <b>♦A</b>, which you do not hold, is a good pick.`) },
          { game: true, text: T('副官にしたい札を選んで「この札を指定」。おすすめは<b>♦A</b>（右の一覧から選べます）。', 'Pick the card for your adjutant and press Call This Card. We suggest the <b>♦A</b> (pick it from the grid).'), sim: { type: 'call', seat: 0, card: 'D14' }, until: (st) => st.phase === 'EXCHANGE' },
          { say: T('伏せてあった<b>交換札3枚</b>（NEW）が手札に入り、13枚になりました。3枚を捨てて10枚に戻します。<br><b>得点札を捨てると表向きで公開され、最初の巡の勝者が取ります</b>。', 'The 3-card <b>kitty</b> (NEW) joined your hand, making 13. Discard 3 to get back to 10.<br><b>Discarded point cards are shown face up and go to the winner of the first trick.</b>') },
          { game: true, text: T('捨てる3枚を選んで「この3枚を捨てる」。弱い札（♦3・♦2・♣2など）がおすすめです。', 'Pick 3 cards and press Discard 3. Weak cards like ♦3, ♦2 and ♣2 are best.'), sim: { type: 'exchange', seat: 0, discards: ['D3', 'D2', 'C2'] }, until: (st) => st.phase === 'PLAY' },
          { say: T('これで準備完了。最初の巡は<b>ナポレオンが先手</b>です。', 'All set. <b>Napoleon leads</b> the first trick.') },
          { game: true, text: T('<b>♠A（マイティ）</b>はいちばん強い札。出して最初の巡を取りましょう。', 'The <b>♠A (Mighty)</b> is the strongest card. Play it to take the first trick.'), allow: ['S14'], until: 'trick', expect: { winner: 0, reason: 'MIGHTY' } },
          { say: (st) => T(`${why(st)}。<br>最初の巡の勝者は、場の得点札に加えて<b>捨て札の得点札</b>も取ります（今回は${st.lastTrick.discardPointCount}枚）。得点札は全部で20枚のままです。`, `${dot(why(st))}<br>The first trick's winner also takes the <b>discarded point cards</b> (${st.lastTrick.discardPointCount} this time). There are still 20 point cards in total.`) },
        ],
      }],
    },
    {
      id: 'adjutant', title: T('5. 秘密の副官', '5. The Secret Adjutant'), desc: T('指定札を出した瞬間に正体が公開', 'Revealed the moment the called card is played'),
      scenes: [{
        cfg: STD,
        scenario: { hands: [['C10', 'JK', 'H4'], ['C5', 'D12', 'H6'], ['C6', 'D5', 'H7'], ['C14', 'D3', 'H8'], ['C3', 'D10', 'H9']],
          napoleon: 3, trump: 'D', calledCard: 'JK', target: 13, leader: 3, trickNo: 1 },
        cpu: { 1: ['C5', 'D12'], 2: ['C6', 'D5'], 3: ['C14', 'D3'], 4: ['C3', 'D10'] },
        steps: [
          { say: T('ナポレオン（レン）は「<b>ジョーカーを持つ人</b>」を副官に指定しました。<br>ジョーカーを持っているのは…<b>あなた</b>です！ あなたは秘密の副官。', 'Napoleon (Ren) called "<b>whoever holds the Joker</b>" as adjutant.<br>And the Joker is... <b>yours</b>! You are the secret adjutant.') },
          { say: T('ほかの人には、あなたが副官だとまだ分かりません（ナポレオン本人も知りません）。<br>指定札を出した瞬間に、全員に公開されます。', 'No one else knows you are the adjutant yet, not even Napoleon.<br>Everyone finds out the moment you play the called card.') },
          { game: true, text: T('ナポレオンが♣Aを出しました。味方が取りそうなので、得点札の<b>♣10</b>を渡しましょう。', 'Napoleon led the ♣A. Your partner should win this, so feed them the <b>♣10</b>.'), allow: ['C10'], until: 'trick', expect: { winner: 3, reason: 'LEAD_SUIT' } },
          { say: (st) => T(`${why(st)}。得点札${ptsOf(st)}枚がナポレオン軍に入りました。<br>副官の正体は、まだ誰にも分かっていません。`, `${dot(why(st))} Napoleon's army got ${ptsOf(st)} point cards.<br>Your identity as the adjutant is still hidden from the other players.`) },
          { game: true, text: T('あなたは♦（切札）を持っていません。指定札の<b>ジョーカー</b>を出して取りましょう。', 'You have no ♦ (trump). Play the called card, the <b>Joker</b>, to win.'), allow: ['JK'], until: 'trick', expect: { winner: 0, reason: 'JOKER' } },
          { say: (st) => T(`「副官判明！」 ${why(st)}。<br>正体が公開されると、画面の集計も<b>ナポレオン軍の合計</b>に切り替わります（公開前に取った分も含めます）。`, `"Adjutant revealed!" ${dot(why(st))}<br>Once revealed, the tally switches to <b>Napoleon's army total</b> (including cards won before the reveal).`) },
        ],
      }],
    },
    {
      id: 'special', title: T('6. 特殊札', '6. Special Cards'), desc: T('マイティ・正J・裏J・ジョーカー・♣3', 'Mighty, Right/Left Jack, Joker, ♣3'),
      scenes: [{
        cfg: STD,
        scenario: { hands: [['S14', 'C3', 'H3'], ['S11', 'C9', 'H5'], ['S2', 'C7', 'JK', 'H14'], ['S3', 'C11', 'H6'], ['S4', 'C5', 'H7']],
          napoleon: 0, trump: 'S', calledCard: 'H14', target: 13, leader: 0, trickNo: 1 },
        cpu: { 1: ['S11', 'C9'], 2: ['S2', 'JK'], 3: ['S3', 'C11'], 4: ['S4', 'C5'] },
        steps: [
          { say: T('あなたはナポレオン、切札は♠です。特別な札の強さは：<br><b>マイティ（♠A）＞ ジョーカー ＞ 正ジャック（切札のJ）＞ 裏ジャック（切札と同じ色のJ）＞ 切札</b>', 'You are Napoleon and trump is ♠. Special cards rank:<br><b>Mighty (♠A) > Joker > Right Jack (trump J) > Left Jack (same-color J) > trump</b>') },
          { game: true, text: T('<b>♠A（マイティ）</b>を出しましょう。クロウの正ジャック（♠J）より強いはずです。', "Play the <b>♠A (Mighty)</b>. It should beat Crow's Right Jack (♠J)."), allow: ['S14'], until: 'trick', expect: { winner: 0, reason: 'MIGHTY' } },
          { say: (st) => T(`${why(st)}。<br>ただしマイティも「♠の札」なので、台札が♦なら♦を持っている間は出せません。`, `${dot(why(st))}<br>But the Mighty is still a spade: if diamonds are led, you cannot play it while you have diamonds.`) },
          { say: T('次は<b>♣3</b>。先手で♣3を出すと「<b>ジョーカー請求</b>」。ジョーカーを持っている人は、♣を持っていても必ずジョーカーを出します。', 'Next, the <b>♣3</b>. Leading ♣3 is a <b>Joker Call</b>: whoever holds the Joker must play it, even with clubs in hand.') },
          { game: true, text: T('<b>♣3</b>を出してみましょう。', 'Try leading the <b>♣3</b>.'), allow: ['C3'], until: 'trick', expect: { winner: 2, reason: 'JOKER' } },
          { say: (st) => T(`${why(st)}。<br>レンの♣Jは<b>裏ジャック</b>（切札♠と同じ黒のJ）でしたが、ジョーカーには負けました。ジョーカーは先手でも後から出しても同じ強さです。`, `${dot(why(st))}<br>Ren's ♣J was the <b>Left Jack</b> (the other black Jack), but it lost to the Joker. The Joker is equally strong led or played later.`) },
        ],
      }, {
        cfg: STD,
        scenario: { hands: [['JK', 'H2'], ['D14', 'S5'], ['D4', 'S6'], ['D6', 'C8'], ['S9', 'C2']],
          napoleon: 0, trump: 'H', calledCard: 'D14', target: 13, leader: 0, trickNo: 2 },
        cpu: {},
        steps: [
          { say: T('最後に、<b>ジョーカーで先手</b>を取る場合。出すときに、ほかの人に出させたいマークを1つ指定します（切札以外でもOK）。', 'Finally, <b>leading the Joker</b>. When you play it, name one suit the others must play (any suit, not just trump).') },
          { game: true, text: T('<b>ジョーカー</b>を選んで出し、マークを指定しましょう（たとえば♦を指定すると、クロウの♦Aを引き出せます）。', "Play the <b>Joker</b> and name a suit (calling ♦ draws out Crow's ♦A)."), allow: ['JK'], sim: { type: 'play', seat: 0, card: 'JK', requestedSuit: 'D' }, until: 'trick', expect: { winner: 0, reason: 'JOKER' } },
          { say: (st) => T(`${why(st)}。<br>指定したマークを持っている人はそれを出し、持っていない人は何でも出せます。`, `${dot(why(st))}<br>Anyone holding the named suit must play it; anyone without it may play anything.`) },
        ],
      }],
    },
    {
      id: 'reversal', title: T('7. 逆転（セイム2・よろめき）', '7. Upsets (Same Two, Swoon)'), desc: T('弱い札が勝つ特別な場面', 'Special cases where a weak card wins'),
      scenes: [{
        cfg: STD,
        scenario: { hands: [['H2', 'C4'], ['H14', 'C5'], ['H13', 'C6'], ['H10', 'S13'], ['H12', 'C7']],
          napoleon: 1, trump: 'S', calledCard: 'S13', target: 13, leader: 1, trickNo: 1 },
        cpu: { 1: ['H14'], 2: ['H13'], 3: ['H10'], 4: ['H12'] },
        steps: [
          { say: T('<b>セイム2</b>：1巡の5枚がすべて同じマーク（ジョーカーなし）なら、そのマークの<b>2</b>が勝ちます。<br>ただし最初の巡では無効。今は2巡目です。', "<b>Same Two</b>: if all five cards in a trick are one suit (no Joker), that suit's <b>2</b> wins.<br>Not in the first trick. This is the second trick.") },
          { game: true, text: T('全員が♥を出しました。最後のあなたは<b>♥2</b>を出しましょう。', 'Everyone played hearts. You play last: the <b>♥2</b>.'), allow: ['H2'], until: 'trick', expect: { winner: 0, reason: 'SAME_TWO' } },
          { say: (st) => T(`${why(st)}！ 得点札${ptsOf(st)}枚を獲得。<br>マイティ・正J・裏Jが混ざっていれば、セイム2は成立しません。`, `${dot(why(st), '!')} You won ${ptsOf(st)} point cards.<br>If the Mighty or either Jack is in the trick, Same Two does not apply.`) },
        ],
      }, {
        cfg: STD,
        scenario: { hands: [['H12', 'C9'], ['S7', 'C10'], ['S14', 'C8'], ['S5', 'C4'], ['S6', 'D13']],
          napoleon: 2, trump: 'D', calledCard: 'D13', target: 13, leader: 2, trickNo: 3 },
        cpu: { 1: ['S7'], 2: ['S14'], 3: ['S5'], 4: ['S6'] },
        steps: [
          { say: T('<b>よろめき</b>：♠A（マイティ）と<b>♥Q</b>が同じ巡に出ると、♥Qが勝ちます。出す順番は関係ありません。', '<b>Swoon</b>: if the ♠A (Mighty) and the <b>♥Q</b> are in the same trick, the ♥Q wins, in any order.') },
          { game: true, text: T('ナポレオンがマイティ（♠A）を出しました！ ♠を持っていないあなたは<b>♥Q</b>で返り討ちにしましょう。', 'Napoleon played the Mighty (♠A)! You have no spades, so strike back with the <b>♥Q</b>.'), allow: ['H12'], until: 'trick', expect: { winner: 0, reason: 'YOROMEKI' } },
          { say: (st) => T(`${why(st)}！<br>♠Aが出ていないときの♥Qは、ただのQです。これでルールはひと通りおしまい！`, `${dot(why(st), '!')}<br>Without the ♠A in the trick, the ♥Q is just a queen. That covers all the rules!`) },
        ],
      }],
    },
  ];

  // ------------------------------------------------------------------ 共通：場面の作成と台本のCPU
  function makeState(scene) {
    const s = scene.scenario;
    return NP.createScenario(scene.cfg, { ...s, seed: 'tutorial' });
  }
  function scriptedCpu(scene, seat, st) {
    if (st.phase === 'BIDDING') return { type: 'pass', seat };
    if (st.phase !== 'PLAY') return null;
    const list = (scene.cpu && scene.cpu[seat]) || [];
    const legal = NP.legalPlays(st.hands[seat], st.trick, st.requestedSuit, st.cfg);
    const c = list.find((x) => legal.includes(x));
    if (c) return { type: 'play', seat, card: c };
    // 台本にない場面は通常CPU（観測情報のみ）
    return NP.AI.decide(NP.getObservation(st, seat), { seed: 'tutorial' });
  }
  function humanSim(step, st) {
    if (step.sim && (step.sim.type !== 'play' || st.phase === 'PLAY')) return step.sim;
    if (st.phase === 'PLAY') {
      const legal = NP.legalPlays(st.hands[0], st.trick, st.requestedSuit, st.cfg);
      const c = (step.allow || legal).find((x) => legal.includes(x));
      return c === 'JK' && !st.trick.length ? { type: 'play', seat: 0, card: c, requestedSuit: 'D' } : { type: 'play', seat: 0, card: c };
    }
    return NP.AI.decide(NP.getObservation(st, 0), { seed: 'tutorial' });
  }

  // DOMなしで最後まで実行（テスト用）
  function simulate(lesson) {
    const errors = [];
    const results = [];
    for (const scene of lesson.scenes) {
      const st = makeState(scene);
      for (const step of scene.steps) {
        if (step.say) { if (typeof step.say === 'function') { try { step.say(st); } catch (e) { errors.push('say: ' + e.message); } } continue; }
        if (st.phase === 'TRICK_RESULT') NP.applyAction(st, { type: 'collect' });
        let guard = 0;
        for (;;) {
          if (++guard > 200) { errors.push('終わらない'); break; }
          if (step.until === 'trick' && st.phase === 'TRICK_RESULT') {
            const lt = st.lastTrick;
            results.push({ lesson: lesson.id, winner: lt.winnerSeat, reason: lt.reasonCode });
            if (step.expect && (lt.winnerSeat !== step.expect.winner || lt.reasonCode !== step.expect.reason)) errors.push(`${lesson.id}: 想定 ${step.expect.winner}/${step.expect.reason} 実際 ${lt.winnerSeat}/${lt.reasonCode}`);
            break;
          }
          if (typeof step.until === 'function' && step.until(st)) break;
          const actor = st.phase === 'BIDDING' || st.phase === 'PLAY' ? st.turn : st.phase === 'TRICK_RESULT' ? null : st.napoleon;
          if (actor == null) { NP.applyAction(st, { type: 'collect' }); continue; }
          const a = actor === 0 ? humanSim(step, st) : scriptedCpu(scene, actor, st);
          if (actor === 0 && step.allow && a.type === 'play' && !step.allow.includes(a.card)) errors.push(`${lesson.id}: 許可札が出せない`);
          const r = NP.applyAction(st, a);
          if (!r.ok) { errors.push(`${lesson.id}: ${r.error} ${JSON.stringify(a)}`); break; }
        }
      }
    }
    return { errors, results };
  }

  // ------------------------------------------------------------------ 画面での進行
  const UIx = () => NP.UI;
  let cur = null; // { lesson, sceneIdx, stepIdx, scene }

  function coach(html, { next = true, nextLabel = T('つぎへ ▶', 'Next ▶') } = {}) {
    const el = document.getElementById('coach');
    el.classList.remove('hidden');
    el.querySelector('.coach-face').innerHTML = NP.Art.avatar('mascot');
    el.querySelector('.coach-title').textContent = cur ? cur.lesson.title : T('チュートリアル', 'Tutorial');
    el.querySelector('.coach-text').innerHTML = html;
    const nb = el.querySelector('.coach-next');
    nb.classList.toggle('hidden', !next);
    nb.textContent = nextLabel;
    nb.onclick = () => { if (nb.classList.contains('hidden')) return; NP.Sound.play('click'); advance(); };
    el.querySelector('.coach-quit').onclick = () => { NP.Sound.play('click'); quit(); };
  }

  function startLesson(lesson, sceneIdx = 0) {
    cur = { lesson, sceneIdx, stepIdx: -1, scene: lesson.scenes[sceneIdx], waiting: false };
    const scene = cur.scene;
    const hooks = {
      gate: () => !cur || !cur.waiting,
      allowCard: (c) => { const s = curStep(); return !s || !s.allow || s.allow.includes(c); },
      denyText: T('チュートリアルでは、コーチが示した札を出してください。', 'In the tutorial, play the card the coach asks for.'),
      // 人間の操作は「操作する段階」で待っているときだけ。札の指定もここで検証する（クリック・Enter・競り・交換すべて）
      allowAction: (a) => {
        const s = curStep();
        if (!cur || !cur.waiting || !s || !s.game) return T('コーチの説明を読んで「つぎへ」を押してください。', "Read the coach's message and press Next.");
        if (a.type === 'play' && s.allow && !s.allow.includes(a.card)) return T('チュートリアルでは、コーチが示した札を出してください。', 'In the tutorial, play the card the coach asks for.');
        return s.deny ? s.deny(a) : null;
      },
      inputLocked: () => { const s = curStep(); return !cur || !cur.waiting || !s || !s.game; },
      cpuAction: (seat, st) => scriptedCpu(scene, seat, st),
      afterAction: () => {
        const s = curStep();
        if (s && s.game && typeof s.until === 'function' && s.until(UIx().sess.st)) { cur.waiting = false; advanceLater(600); }
      },
      onTrickResult: () => {
        const s = curStep();
        if (s && s.until === 'trick') { cur.waiting = false; advanceLater(1400); return true; }
        return false;
      },
      holdTrick: true,
      noHint: true,
      goalText: () => '',
    };
    UIx().startSession({ mode: 'tutorial', st: makeState(scene), human: 0, hooks, hint: false, recordStats: false, onExit: () => { cur = null; UIx().showTitle(); } });
    advance();
  }
  function curStep() { return cur && cur.scene.steps[cur.stepIdx]; }
  // 少し待ってから次の段階へ。セッション終了で解除され、予約したときと同じレッスン・段階のときだけ進める
  function advanceLater(ms) {
    const token = cur, idx = cur.stepIdx;
    UIx().later(() => { if (cur === token && cur.stepIdx === idx) advance(); }, ms);
  }

  function advance() {
    if (!cur || !UIx().sess) return;
    cur.stepIdx++;
    const s = curStep();
    const st = UIx().sess.st;
    if (!s) {
      // 次の場面 or レッスン完了
      if (cur.sceneIdx + 1 < cur.lesson.scenes.length) { startLesson(cur.lesson, cur.sceneIdx + 1); return; }
      finish();
      return;
    }
    if (s.say) {
      cur.waiting = false;
      coach(typeof s.say === 'function' ? s.say(st) : s.say);
      UIx().render();
      return;
    }
    // 操作する段階
    coach(s.text, { next: false });
    cur.waiting = true;
    if (st.phase === 'TRICK_RESULT') { document.getElementById('trick-banner').classList.add('hidden'); UIx().act({ type: 'collect' }); }
    else { UIx().render(); UIx().step(); }
  }

  function finish() {
    const S = UIx().settings;
    const id = cur.lesson.id;
    if (!S.tutorialDone.includes(id)) { S.tutorialDone.push(id); UIx().saveSettings(); }
    const idx = LESSONS.indexOf(cur.lesson);
    const nextL = LESSONS[idx + 1];
    coach(T(`<b>「${cur.lesson.title}」完了！</b><br>${nextL ? `次は「${nextL.title}」です。` : '次は「8. 練習1局」で、ヒントを見ながら最後まで遊んでみましょう。'}`, `<b>"${cur.lesson.title}" complete!</b><br>${nextL ? `Next up: "${nextL.title}".` : 'Next, try "8. Practice Round" and play a full round with hints.'}`), { nextLabel: nextL ? T('次のレッスンへ ▶', 'Next Lesson ▶') : T('練習1局へ ▶', 'Practice Round ▶') });
    const el = document.getElementById('coach');
    el.querySelector('.coach-next').onclick = () => { NP.Sound.play('click'); if (nextL) startLesson(nextL); else practice(); };
  }

  function quit() {
    cur = null;
    document.getElementById('coach').classList.add('hidden');
    UIx().showTitle();
    menu();
  }

  function practice() {
    cur = null;
    document.getElementById('coach').classList.add('hidden');
    UIx().startSession({ mode: 'practice', cfg: { preset: 'standard', rounds: 1 }, seed: 'practice-' + Date.now(), human: 0, chars: UIx().charOrder(), hint: true, recordStats: false, onExit: UIx().showTitle });
    UIx().toast(T('練習1局：標準ルール＋ヒント付き。戦績には入りません', 'Practice round: full rules with hints. Not recorded in stats'), 3600);
  }

  function menu() {
    const U = UIx();
    const done = U.settings.tutorialDone;
    const items = LESSONS.map((L, i) => `<button class="lesson-btn ${done.includes(L.id) ? 'done' : ''}" data-l="${i}"><b>${L.title}</b><small>${L.desc}</small>${done.includes(L.id) ? '<i>✓</i>' : ''}</button>`).join('');
    U.modal(`<div class="m-title">${T('チュートリアル', 'Tutorial')}</div><p class="m-small">${T('各レッスンは数分。いつでも中断・再受講できます。', 'Each lesson takes a few minutes. Quit or retake any time.')}</p>
      <div class="lesson-list">${items}<button class="lesson-btn" data-l="practice"><b>${T('8. 練習1局', '8. Practice Round')}</b><small>${T('標準ルール＋ヒントで最後まで（戦績に入りません）', 'A full round with hints (not recorded in stats)')}</small></button></div>
      <div class="m-buttons"><button class="big-btn white" data-act="close">${T('戻る', 'Back')}</button></div>`, { close: U.closeModal }, { wide: true });
    for (const b of document.querySelectorAll('[data-l]')) b.onclick = () => {
      NP.Sound.play('click');
      U.closeModal();
      if (b.dataset.l === 'practice') practice(); else startLesson(LESSONS[+b.dataset.l]);
    };
  }

  NP.Tutorial = { LESSONS, simulate, menu, practice, startLesson };
})(typeof window !== 'undefined' ? window : globalThis);
