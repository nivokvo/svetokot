// Тема «Котики» Светокота: своя раскладка поверх общего ядра Mini App (window.App в app.html).
// Лампа — это кот-ночник: тело светится цветом ламп (в режиме «Обе» — двумя цветами), глаза следят за пальцем,
// выключенный кот сворачивается и спит. Тап — вкл/выкл, погладить вверх-вниз или вбок — яркость (кот мурчит),
// хвост внизу — тот же ползунок яркости, лапки — готовые оттенки, полоски — точная настройка.

// Фирменные сцены темы: у двух ламп разные цвета, как два кота разной масти.
const SIGNATURE = [
  {name: "Клубника", list: [{lamps: [0], kind: "hsv", value: {h: 340, s: 80, b: 80}}, {lamps: [1], kind: "hsv", value: {h: 18, s: 70, b: 80}}]},
  {name: "Неко-неон", list: [{lamps: [0], kind: "hsv", value: {h: 305, s: 100, b: 75}}, {lamps: [1], kind: "hsv", value: {h: 188, s: 100, b: 75}}]},
  {name: "Лунный кот", list: [{lamps: [0], kind: "hsv", value: {h: 232, s: 90, b: 55}}, {lamps: [1], kind: "hsv", value: {h: 268, s: 60, b: 55}}]},
  {name: "Рыжик", list: [{lamps: [0], kind: "hsv", value: {h: 24, s: 95, b: 85}}, {lamps: [1], kind: "temp", value: {k: 2700, b: 85}}]},
  {name: "Молочко", list: [{lamps: [0, 1], kind: "temp", value: {k: 4500, b: 100}}]},
];
const YANDEX = {ocean: "Океан", romance: "Романтика", night: "Ночь", dinner: "Ужин", garland: "Гирлянда", rest: "Отдых"};
const WHITES = [[2200, "Свеча"], [2700, "Тёплый"], [4000, "Нейтр."], [5500, "День"], [6500, "Холод"]];
const HUES = [[355, 90], [25, 95], [50, 90], [140, 75], [195, 90], [250, 85], [310, 70]];
const patchOf = (kind, v) => kind === "hsv" ? {mode: "hsv", hsv: {h: v.h, s: v.s, v: 100}, bright: v.b || 100}
  : kind === "temp" ? {mode: "temp", temp: v.k, bright: v.b || 100} : {mode: "scene", scene: kind === "night" ? "candle" : v};

const INK = "#2b0a24";
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const SLEEPY = [104, 64, 96];

// ---------- рисунки ----------
// силуэт сидящего кота-ночника анфас: уши, щёки, талия под ошейник, круглое тело
const BODY = "M72 274C38 274 30 236 40 200C46 172 64 162 64 150C52 140 48 112 60 92C64 78 68 60 72 44Q75 31 87 37L124 66Q150 58 176 66L213 37Q225 31 228 44C232 60 236 78 240 92C252 112 248 140 236 150C236 162 254 172 260 200C270 236 262 274 228 274Z";
const TAIL_UP = "M226 254C284 258 304 196 280 170C270 158 274 140 290 138";
const TAIL_WRAP = "M234 258C262 296 128 302 86 282C74 276 80 262 94 268";
const CAT = `<svg class="cat" viewBox="0 0 300 300" aria-hidden="true">
  <defs>
    <linearGradient id="cats-fur" x1="0" x2="1"><stop id="cats-c1" offset=".3" stop-color="#ffc4dc"/><stop id="cats-c2" offset=".7" stop-color="#ffc4dc"/></linearGradient>
    <clipPath id="cats-clip"><path d="${BODY}"/></clipPath>
  </defs>
  <g class="cat-tail"><path d="${TAIL_UP}" fill="none" stroke="${INK}" stroke-width="27" stroke-linecap="round"/><path d="${TAIL_UP}" fill="none" stroke="url(#cats-fur)" stroke-width="19" stroke-linecap="round"/>
    <path d="M281 168C272 158 275 143 288 139" fill="none" stroke="${INK}" stroke-opacity=".28" stroke-width="7" stroke-linecap="round"/></g>
  <g class="cat-body">
    <path d="${BODY}" fill="url(#cats-fur)"/>
    <g clip-path="url(#cats-clip)">
      <ellipse cx="150" cy="226" rx="66" ry="46" fill="#fff" opacity=".38"/>
      <ellipse cx="104" cy="96" rx="30" ry="15" fill="#fff" opacity=".5" transform="rotate(-28 104 96)"/>
      <path d="M58 150Q150 176 242 150" fill="none" stroke="#ff3f8e" stroke-width="12"/>
      <path d="M58 150Q150 176 242 150" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="1 9" stroke-linecap="round"/>
    </g>
    <path class="cat-line" d="${BODY}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M84 50Q86 44 92 48L112 64Q96 68 86 80Z M216 50Q214 44 208 48L188 64Q204 68 214 80Z" fill="#ff8fbf"/>
    <g class="cat-face">
      <g class="cat-eye-open">
        <ellipse cx="118" cy="112" rx="16" ry="17" fill="#fff" stroke="${INK}" stroke-width="3.5"/><ellipse cx="182" cy="112" rx="16" ry="17" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
        <g class="cat-pupil" id="cats-p1"><ellipse cx="118" cy="113" rx="8.5" ry="11.5" fill="${INK}"/><circle cx="115" cy="108" r="3.2" fill="#fff"/></g>
        <g class="cat-pupil" id="cats-p2"><ellipse cx="182" cy="113" rx="8.5" ry="11.5" fill="${INK}"/><circle cx="179" cy="108" r="3.2" fill="#fff"/></g>
      </g>
      <path class="cat-eye-happy" d="M103 118Q118 98 133 118M167 118Q182 98 197 118" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <path class="cat-eye-sleep" d="M104 112Q118 124 132 112M168 112Q182 124 196 112" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="96" cy="136" rx="11" ry="6.5" fill="#ff5fa5" opacity=".55"/><ellipse cx="204" cy="136" rx="11" ry="6.5" fill="#ff5fa5" opacity=".55"/>
      <path d="M143 127Q150 124 157 127Q155 133 150 135Q145 133 143 127Z" fill="#ff3f8e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M150 135V139M138 138Q144 146 150 139Q156 146 162 138" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M98 128L46 120M98 135L42 138M100 142L50 156M202 128L254 120M202 135L258 138M200 142L250 156" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g class="cat-tag"><path d="M150 162V166" stroke="${INK}" stroke-width="3"/><circle cx="150" cy="180" r="16" fill="#ffd23f" stroke="${INK}" stroke-width="3.5"/>
      <text id="cats-tag" x="150" y="184.5" text-anchor="middle">—</text></g>
    <g fill="url(#cats-fur)" stroke="${INK}" stroke-width="4.5"><ellipse cx="120" cy="268" rx="20" ry="12"/><ellipse cx="180" cy="268" rx="20" ry="12"/></g>
    <path d="M114 266v6M126 266v6M174 266v6M186 266v6" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <g class="cat-wrap"><path d="${TAIL_WRAP}" fill="none" stroke="${INK}" stroke-width="27" stroke-linecap="round"/><path d="${TAIL_WRAP}" fill="none" stroke="url(#cats-fur)" stroke-width="19" stroke-linecap="round"/></g>
</svg>`;
const PAW = c => `<svg viewBox="0 0 40 40"><path d="M20 20c-6 0-11 5-11 10 0 4 3 6 6 5 2-.5 3-1.5 5-1.5s3 1 5 1.5c3 1 6-1 6-5 0-5-5-10-11-10z" fill="${c}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><g fill="${c}" stroke="${INK}" stroke-width="2.2"><ellipse cx="8.5" cy="18" rx="3.6" ry="4.6" transform="rotate(-22 8.5 18)"/><ellipse cx="15.5" cy="10" rx="3.8" ry="5"/><ellipse cx="24.5" cy="10" rx="3.8" ry="5"/><ellipse cx="31.5" cy="18" rx="3.6" ry="4.6" transform="rotate(22 31.5 18)"/></g></svg>`;
const HEAD = c => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30"><path d="M5 27C2 21 3 15 5 11L4 2l8 5q4-1 8 0l8-5-1 9c2 4 3 10 0 16q-11 4-22 0z" fill="${c}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="11.5" cy="17" r="1.8" fill="${INK}"/><circle cx="20.5" cy="17" r="1.8" fill="${INK}"/><path d="M14.5 21.5q1.5 1.2 3 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const TIP = `<svg viewBox="0 0 40 40"><path d="M7 20C7 12 13 6 21 7c4-3 10-1 11 4 5 2 6 8 2 11 3 4 1 10-4 10-2 4-9 5-12 1C11 34 7 28 7 20z" fill="rgb(var(--t2))" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 14c3 1 5 4 5 7" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".4"/></svg>`;
const ICON = {
  modes: `<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8"/>`,
  scenes: `<path d="M12 4l2.2 5 5.3.5-4 3.6 1.2 5.3L12 15.6 7.3 18.4l1.2-5.3-4-3.6 5.3-.5z"/>`,
  theme: `<path d="M12 4a8 8 0 1 0 0 16c1 0 1.5-.7 1.5-1.5 0-.8-.5-1.2-.5-2 0-.9.7-1.5 1.6-1.5H16a4 4 0 0 0 4-4c0-4-3.6-7-8-7z"/><circle cx="8" cy="11" r=".6"/><circle cx="11" cy="7.6" r=".6"/><circle cx="15.5" cy="8.4" r=".6"/>`,
  more: `<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>`,
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Nunito:wght@700;800;900&display=swap");
html[data-theme="pink"] { --bg: #fff4ea; --text: #2b0a24; --hint: #8d4a78; --accent: #ff3f8e; --accent-text: #fff; --danger: #d61f55;
  --card: #fff; --card2: #ffe1ee; --line: rgba(43,10,36,.16); }
html[data-theme="pink"] body { padding: 0; overflow: hidden; background: #ffd6e8; }
.cats { --ink: #2b0a24; --pink: #ff3f8e; --cream: #fff4ea; --g1: 255,190,215; --g2: 255,190,215; --gi: 0; --t1: 255,196,220; --t2: 255,140,190; --p: 0;
  position: relative; height: var(--tg-viewport-stable-height, 100dvh); min-height: 520px; display: flex; flex-direction: column; overflow: hidden; color: var(--ink);
  background: #ffd6e8 radial-gradient(rgba(255,63,142,.2) 1.3px, transparent 1.6px) 0 0 / 14px 14px;
  font: 800 13px/1.25 Nunito, system-ui, sans-serif; user-select: none; -webkit-user-select: none; }
.cats * { box-sizing: border-box; }
.cats button { font: inherit; color: inherit; -webkit-tap-highlight-color: transparent; }
.cats :is(.cats-seg, .cats-tabs button, .cats-nav button, .cats-card, .cats-pause) { transition: transform .1s, box-shadow .1s; }

/* ---------- шапка ---------- */
.cats-top { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px 8px; }
.cats-logo { font: 800 21px/1 Unbounded, system-ui, sans-serif; letter-spacing: -.8px; white-space: nowrap; }
.cats-logo i { font-style: normal; color: var(--pink); -webkit-text-stroke: 1.2px var(--ink); }
.cats-seg { display: flex; min-width: 0; padding: 2px; gap: 1px; border: 2.5px solid var(--ink); border-radius: 999px; background: var(--cream); box-shadow: 2px 2px 0 var(--ink); }
.cats-seg button { border: 0; background: none; border-radius: 999px; padding: 5px 9px; font-size: 11.5px; cursor: pointer; white-space: nowrap; max-width: 92px; overflow: hidden; text-overflow: ellipsis; }
.cats-seg button.on { background: var(--ink); color: var(--cream); }

/* ---------- сцена с котом ---------- */
.cats-stage { position: relative; flex: 1 1 auto; min-height: 220px; margin: 2px 14px 0; padding: 10px 10px 12px; display: flex; flex-direction: column; align-items: center;
  border: 3px solid var(--ink); border-radius: 30px; box-shadow: 5px 5px 0 var(--ink); overflow: hidden; touch-action: none; cursor: pointer;
  background: radial-gradient(rgba(255,255,255,.32) 1.5px, transparent 1.8px) 0 0 / 16px 16px, linear-gradient(180deg, #ff8cc0, #ff5aa2); }
.cats-sky { position: absolute; inset: 0; opacity: 0; transition: opacity .7s; pointer-events: none;
  background: radial-gradient(circle at 12% 16%, #fff 0 1.4px, transparent 2px), radial-gradient(circle at 28% 9%, #ffe9a8 0 1px, transparent 1.6px),
    radial-gradient(circle at 46% 20%, #fff 0 1.2px, transparent 1.8px), radial-gradient(circle at 8% 52%, #ffe9a8 0 1.2px, transparent 1.8px),
    radial-gradient(circle at 91% 46%, #fff 0 1.5px, transparent 2px), radial-gradient(circle at 70% 12%, #fff 0 1px, transparent 1.6px),
    radial-gradient(circle at 18% 78%, #fff 0 1px, transparent 1.6px), radial-gradient(circle at 86% 74%, #ffe9a8 0 1.3px, transparent 1.9px),
    radial-gradient(120% 70% at 50% 100%, #4a1541, transparent 70%), linear-gradient(180deg, #2a0a25, #1a0517); }
.cats-sky .moon { position: absolute; right: 22px; top: 18px; width: 34px; height: 34px; border-radius: 50%; box-shadow: inset -9px 5px 0 0 #ffe9a8; transform: rotate(-12deg); }
.cats.sleep .cats-sky { opacity: 1; }
.cats-glow { position: absolute; left: 50%; top: 44%; width: 150%; aspect-ratio: 1; transform: translate(-50%, -50%); pointer-events: none; mix-blend-mode: screen;
  background: radial-gradient(36% 36% at 40% 50%, rgba(var(--g1), .95), rgba(var(--g1), 0)), radial-gradient(36% 36% at 60% 50%, rgba(var(--g2), .95), rgba(var(--g2), 0));
  opacity: var(--gi); transition: opacity .45s; }
.cats-cat { position: relative; flex: 1 1 auto; min-height: 0; width: 100%; display: flex; justify-content: center; }
.cats .cat { height: 100%; max-height: 300px; aspect-ratio: 1; max-width: 100%; overflow: visible; display: block; }
.cats .cat * { transform-box: view-box; }
.cat-body { transform-origin: 150px 278px; transition: transform .7s cubic-bezier(.3,1.5,.5,1); }
.cats.sleep .cat-body { transform: translateY(4px) scale(1.08, .84); }
.cat-line { transition: stroke .6s; }
.cats.sleep .cat-line { stroke: #ff9ccb; }
.cats.sleep .cat { filter: drop-shadow(0 0 16px rgba(255,120,190,.3)); }
.cats.purr .cat-body { animation: breathe .45s ease-in-out infinite alternate; }
@keyframes breathe { to { transform: scale(1.025, .985); } }
.cats.wake .cat-body { animation: wake .55s cubic-bezier(.3,1.6,.5,1); }
@keyframes wake { 30% { transform: scale(.94, 1.1) translateY(-10px); } }
.cat-tail { transform-origin: 226px 254px; animation: wag 2.8s ease-in-out infinite; transition: opacity .4s; }
.cats.purr .cat-tail { animation-duration: .7s; }
@keyframes wag { 50% { transform: rotate(-10deg); } }
.cat-wrap { opacity: 0; transition: opacity .5s; }
.cats.sleep .cat-tail { opacity: 0; } .cats.sleep .cat-wrap { opacity: 1; }
.cat-eye-open, .cat-eye-happy, .cat-eye-sleep { transition: opacity .18s; }
.cat-eye-open { transform-box: fill-box; transform-origin: center; }
.cats.blink .cat-eye-open { transform: scaleY(.08); transition: transform .06s; }
.cat-eye-happy, .cat-eye-sleep { opacity: 0; }
.cats.purr .cat-eye-open, .cats.sleep .cat-eye-open { opacity: 0; }
.cats.purr:not(.sleep) .cat-eye-happy, .cats.sleep .cat-eye-sleep { opacity: 1; }
.cat-pupil { transition: transform .14s ease-out; }
.cat-tag text { font: 800 11px Unbounded, sans-serif; fill: var(--ink); }
.cats-z { position: absolute; left: calc(50% + 34px); top: 18%; opacity: 0; transition: opacity .5s; pointer-events: none; }
.cats.sleep .cats-z { opacity: 1; }
.cats-z i { position: absolute; font: 800 18px Unbounded, sans-serif; font-style: normal; color: #ffe9a8; opacity: 0; animation: zz 3.3s linear infinite; }
.cats-z i:nth-child(2) { animation-delay: 1.1s; font-size: 13px; } .cats-z i:nth-child(3) { animation-delay: 2.2s; font-size: 23px; }
@keyframes zz { 12% { opacity: 1; } 100% { transform: translate(30px, -64px) rotate(14deg); opacity: 0; } }
.cats-status { position: relative; text-align: center; pointer-events: none; transition: color .5s; min-height: 40px; }
.cats-status b { display: block; font: 800 19px/1.1 Unbounded, sans-serif; letter-spacing: -.4px; }
.cats-status small { display: block; margin-top: 3px; font-size: 12px; opacity: .78; }
.cats.sleep .cats-status { color: #ffe3f0; }
.cats-pause { position: relative; margin-top: 8px; border: 2.5px solid var(--ink); border-radius: 999px; background: var(--cream); padding: 4px 6px 4px 11px; font-size: 11.5px;
  box-shadow: 2px 2px 0 var(--ink); cursor: pointer; display: inline-flex; gap: 8px; align-items: center; }
.cats-pause u { text-decoration: none; background: var(--pink); color: #fff; border-radius: 999px; padding: 2px 8px; }
.cats-bubble, .cats-hint { position: absolute; left: 50%; top: 12px; z-index: 3; pointer-events: none; border: 3px solid var(--ink); background: var(--cream); white-space: nowrap; }
.cats-bubble { padding: 3px 14px 5px; border-radius: 18px; font: 800 30px/1 Unbounded, sans-serif; box-shadow: 4px 4px 0 var(--ink);
  opacity: 0; transform: translateX(-50%) rotate(-5deg) scale(.5); transition: opacity .15s, transform .2s cubic-bezier(.3,1.6,.5,1); }
.cats-bubble.on { opacity: 1; transform: translateX(-50%) rotate(-5deg) scale(1); }
.cats-hint { padding: 5px 11px; border-radius: 14px; font-size: 11.5px; box-shadow: 3px 3px 0 var(--ink); transform: translateX(-50%) rotate(2deg); transition: opacity .6s; }
.cats-hint:empty { display: none; }
.cats-heart { position: absolute; z-index: 2; pointer-events: none; font-size: 22px; line-height: 1; color: var(--pink); -webkit-text-stroke: 2px var(--ink);
  animation: heart .95s ease-out forwards; }
@keyframes heart { from { transform: translate(-50%, -50%) scale(.3); opacity: 1; } to { transform: translate(-50%, -190%) scale(1.15) rotate(var(--r)); opacity: 0; } }

/* ---------- пульт ---------- */
.cats-ctl { flex: 0 0 auto; display: grid; gap: 10px; padding: 12px 14px calc(10px + env(safe-area-inset-bottom)); }
.cats-tailrow { display: flex; align-items: center; gap: 10px; }
.cats-tailrow .lbl { flex: 0 0 50px; font: 600 10px/1.1 Unbounded, sans-serif; }
.cats-tailrow .lbl b { display: block; font-size: 16px; font-weight: 800; letter-spacing: -.5px; }
.cats-tail, .cats-strip { position: relative; flex: 1; touch-action: none; cursor: pointer; }
.cats-tail { height: 38px; }
.cats-tail::before { content: ""; position: absolute; inset: 7px 2px; border-radius: 999px; border: 2.5px dashed rgba(43,10,36,.4); background: rgba(255,244,234,.55); }
.cats-tail .fill { position: absolute; left: 0; top: 7px; bottom: 7px; width: calc(19px + (100% - 38px) * var(--p)); border: 2.5px solid var(--ink); border-radius: 999px;
  background: repeating-linear-gradient(118deg, rgb(var(--t1)) 0 13px, rgb(var(--t2)) 13px 20px); box-shadow: 2px 2px 0 var(--ink); }
.cats-tail .tip { position: absolute; top: 0; left: calc((100% - 38px) * var(--p)); width: 38px; height: 38px; filter: drop-shadow(2px 2px 0 var(--ink)); }
.cats-tail .tip svg, .cats-strip .knob svg { width: 100%; height: 100%; display: block; }
.cats-tabs { display: flex; gap: 7px; }
.cats-tabs button { flex: 1; border: 2.5px solid var(--ink); background: var(--cream); border-radius: 14px; padding: 6px 0 7px; cursor: pointer;
  font: 800 11.5px Unbounded, sans-serif; box-shadow: 2px 2px 0 var(--ink); }
.cats-tabs button.on { background: var(--pink); color: #fff; }
.cats :is(.cats-tabs button, .cats-nav button, .cats-pause, .cats-card):active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
.cats-pane { display: none; height: 98px; }
.cats-pane.on { display: grid; gap: 7px; align-content: start; }
.cats-paws { display: flex; justify-content: space-between; gap: 2px; }
.cats-paws button { flex: 1; min-width: 0; max-width: 64px; border: 2.5px solid transparent; background: none; border-radius: 16px; padding: 2px 0 3px; cursor: pointer;
  display: grid; justify-items: center; gap: 1px; font-size: 10.5px; transition: transform .12s; }
.cats-paws button svg { width: 38px; height: 38px; display: block; transition: transform .2s cubic-bezier(.3,1.6,.5,1); }
.cats-paws button:active svg { transform: scale(.85) rotate(-8deg); }
.cats-paws button.on { border-color: var(--ink); background: var(--cream); box-shadow: 2px 2px 0 var(--ink); }
.cats-paws button.on svg { transform: rotate(-10deg); }
.cats-strip { height: 30px; }
.cats-strip::before { content: ""; position: absolute; inset: 6px 2px; border-radius: 999px; border: 2.5px solid var(--ink); background: var(--grad); box-shadow: 2px 2px 0 var(--ink); }
.cats-strip .knob { position: absolute; top: -1px; left: calc((100% - 32px) * var(--p)); width: 32px; height: 30px; filter: drop-shadow(2px 2px 0 var(--ink)); }
.cats-scenes { display: flex; gap: 8px; overflow-x: auto; overscroll-behavior-x: contain; touch-action: pan-x; scrollbar-width: none; margin: 0 -14px; padding: 1px 14px 5px; }
.cats-scenes::-webkit-scrollbar { display: none; }
.cats-card { flex: 0 0 86px; height: 84px; border: 2.5px solid var(--ink); border-radius: 18px; background: var(--cream); box-shadow: 3px 3px 0 var(--ink); cursor: pointer;
  display: grid; grid-template-rows: 1fr auto; justify-items: center; align-items: center; padding: 6px 4px 7px; font-size: 11px; text-align: center; line-height: 1.1; }
.cats-card .heads { display: flex; }
.cats-card .heads svg { width: 30px; height: 28px; }
.cats-card .heads svg + svg { margin-left: -7px; transform: rotate(8deg); }
.cats-card.on { background: var(--pink); color: #fff; }
.cats-card span { max-width: 78px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cats-nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
.cats-nav button { height: 40px; border: 2.5px solid var(--ink); border-radius: 999px; background: var(--cream); box-shadow: 2px 2px 0 var(--ink); cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 4px; font-size: 11.5px; white-space: nowrap; }
.cats-nav svg { width: 16px; height: 16px; flex: 0 0 auto; }
@media (max-height: 640px) { .cats-pane { height: 90px; } .cats-ctl { gap: 8px; padding-top: 10px; } .cats-paws button svg { width: 32px; height: 32px; } }
@media (prefers-reduced-motion: reduce) { .cats *, .cats *::before { animation: none !important; } }

/* ---------- окна «Режимы», «Пресеты», «Тема», «Ещё»: наклейки с чернильным контуром, как пульт ---------- */
html[data-theme="pink"] .sheet { background: rgba(43,10,36,.5); }
html[data-theme="pink"] :is(.sheet-card, #settings) { font-family: Nunito, system-ui, sans-serif; font-weight: 700; color: #2b0a24; }
html[data-theme="pink"] .sheet-card { background: #fff4ea; border: 3px solid #2b0a24; border-bottom: 0; border-radius: 30px 30px 0 0; padding: 0 14px 26px;
  box-shadow: 0 -5px 0 #ff3f8e; animation: rise .4s cubic-bezier(.2,1.2,.3,1.1); }
html[data-theme="pink"] .sheet-head { background: #fff4ea; margin: 0 -14px 6px; padding: 14px 16px 10px; border-bottom: 2.5px dashed rgba(43,10,36,.25); }
html[data-theme="pink"] .sheet-head b, html[data-theme="pink"] #settings h1 { font: 800 19px Unbounded, sans-serif; letter-spacing: -.5px; color: #2b0a24; display: flex; align-items: center; gap: 8px; }
html[data-theme="pink"] .sheet-head b::before { content: ""; width: 28px; height: 26px; flex: 0 0 auto;
  background: url("data:image/svg+xml,${encodeURIComponent(HEAD("#ff8fbf"))}") center / contain no-repeat; }
html[data-theme="pink"] .sheet-x { width: 34px; height: 34px; border: 2.5px solid #2b0a24; background: #ff3f8e; color: #fff; font-size: 20px; font-weight: 900; line-height: 1;
  box-shadow: 2px 2px 0 #2b0a24; }
html[data-theme="pink"] :is(.sheet, #settings) .card { background: #fff; border: 2.5px solid #2b0a24; border-radius: 22px; box-shadow: 4px 4px 0 #2b0a24; }
html[data-theme="pink"] :is(.sheet, #settings) .card + .card { margin-top: 14px; }
html[data-theme="pink"] :is(.sheet, #settings) .ttl { font: 800 14px Unbounded, sans-serif; letter-spacing: -.3px; }
html[data-theme="pink"] .sheet .hint, html[data-theme="pink"] #settings .hint { color: #8d4a78; font-weight: 700; }
html[data-theme="pink"] #settings h2 { font: 800 11px Unbounded, sans-serif; color: #2b0a24; letter-spacing: .3px; margin: 22px 0 9px; }
html[data-theme="pink"] :is(.sheet, #settings) .sw { background: #ffe1ee; border: 2.5px solid #2b0a24; width: 50px; height: 30px; }
html[data-theme="pink"] :is(.sheet, #settings) .sw::after { top: 2px; left: 2px; width: 21px; height: 21px; background: #fff; box-shadow: 0 0 0 2.5px #2b0a24; }
html[data-theme="pink"] :is(.sheet, #settings) .sw.on { background: #ff3f8e; }
html[data-theme="pink"] .sheet .stepper { background: #ffe9f2; border: 2px solid #2b0a24; border-radius: 14px; }
html[data-theme="pink"] .sheet .stepper { padding: 8px 2px; }
html[data-theme="pink"] .sheet .stepper span { font-size: 11.5px; }
html[data-theme="pink"] .sheet .stepper button { width: 20px; }
html[data-theme="pink"] .sheet .stepper small { color: #8d4a78; font-weight: 800; }
html[data-theme="pink"] .sheet .stepper button { color: #ff3f8e; font-weight: 900; }
html[data-theme="pink"] .sheet .chart text { fill: #8d4a78; font-family: Nunito, sans-serif; font-weight: 800; }
html[data-theme="pink"] :is(.sheet, #settings) .btn { border: 2.5px solid #2b0a24; border-radius: 14px; background: #ff3f8e; color: #fff; font-weight: 900; box-shadow: 2px 2px 0 #2b0a24; }
html[data-theme="pink"] :is(.sheet, #settings) .btn:active { transform: translate(2px, 2px); box-shadow: none; }
html[data-theme="pink"] :is(.sheet, #settings) .btn.ghost { background: #fff4ea; color: #2b0a24; }
html[data-theme="pink"] :is(.sheet, #settings) .btn.danger { border: 0; background: none; box-shadow: none; color: #d61f55; }
html[data-theme="pink"] .sheet :is(.timers button, .days button, .chip, .preset) { border: 2px solid #2b0a24; background: #fff4ea; color: #2b0a24; font-weight: 800; }
html[data-theme="pink"] .sheet .timers button { border-radius: 14px; font: 800 13px Unbounded, sans-serif; box-shadow: 2px 2px 0 #2b0a24; }
html[data-theme="pink"] .sheet :is(.days button.on, .chip.on) { background: #ff3f8e; color: #fff; }
html[data-theme="pink"] .sheet .alarm .tm { font: 800 24px Unbounded, sans-serif; letter-spacing: -1px; }
html[data-theme="pink"] .sheet .alarm + .alarm { border-top: 2px dashed rgba(43,10,36,.2); }
html[data-theme="pink"] .sheet .bar { height: 12px; border: 2px solid #2b0a24; background: #fff4ea; border-radius: 999px; }
html[data-theme="pink"] .sheet .bar i { background: repeating-linear-gradient(118deg, #ff8fbf 0 8px, #ff3f8e 8px 13px); }
html[data-theme="pink"] .sheet .editor { border-top: 2px dashed rgba(43,10,36,.25); }
html[data-theme="pink"] .sheet .editor input[type=time] { background: #fff4ea; border: 2px solid #2b0a24; font-family: Unbounded, sans-serif; color: #2b0a24; }
html[data-theme="pink"] .sheet .night { border: 2.5px solid #2b0a24; border-radius: 22px; box-shadow: 4px 4px 0 #2b0a24; background: linear-gradient(135deg, #2a0a25, #5a1f4a); }
html[data-theme="pink"] .sheet .night b { font: 800 16px Unbounded, sans-serif; }
html[data-theme="pink"] .sheet .night .ic { box-shadow: 0 0 0 2.5px #2b0a24, 0 0 22px #ff9a3c; }
html[data-theme="pink"] .sheet .scenes { gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
html[data-theme="pink"] .sheet .scene { border: 2.5px solid #2b0a24; border-radius: 20px; box-shadow: 3px 3px 0 #2b0a24; font: 800 11px Unbounded, sans-serif; text-shadow: 0 1px 0 rgba(0,0,0,.35); min-width: 0; overflow: hidden; }
html[data-theme="pink"] .sheet :is(.scene.on, .night.on) { box-shadow: 0 0 0 3px #ff3f8e, 3px 3px 0 3px #2b0a24; }
html[data-theme="pink"] .sheet h2 { font: 800 12px Unbounded, sans-serif; color: #2b0a24; }
html[data-theme="pink"] .sheet .preset { border-radius: 999px; box-shadow: 2px 2px 0 #2b0a24; }
html[data-theme="pink"] .sheet .preset i { box-shadow: 0 0 0 2px #2b0a24; }
html[data-theme="pink"] :is(.sheet, #settings) :is(.save input, .field input) { background: #fff; border: 2px solid #2b0a24; border-radius: 14px; color: #2b0a24; font-weight: 700; }
html[data-theme="pink"] #settings .field input { padding: 7px 10px; }
html[data-theme="pink"] #settings :is(.field + .field, .user + .user) { border-top: 2px dashed rgba(43,10,36,.18); }
html[data-theme="pink"] .sheet .opts { gap: 9px; }
html[data-theme="pink"] .sheet .opts button { border: 2.5px solid #2b0a24; border-radius: 18px; background: #fff; box-shadow: 3px 3px 0 #2b0a24; font: 800 14px Unbounded, sans-serif; color: #2b0a24; align-items: center; }
html[data-theme="pink"] .sheet .opts button .hint { font: 800 11px Nunito, sans-serif; }
html[data-theme="pink"] .sheet .opts button.on { background: #ff3f8e; color: #fff; box-shadow: 3px 3px 0 #2b0a24; }
html[data-theme="pink"] .sheet .opts button.on .hint { color: #fff; }
html[data-theme="pink"] #settings { height: var(--tg-viewport-stable-height, 100dvh); overflow-y: auto; padding: 14px 16px 34px;
  background: #ffd6e8 radial-gradient(rgba(255,63,142,.2) 1.3px, transparent 1.6px) 0 0 / 14px 14px; }
html[data-theme="pink"] #settings .back { border: 2.5px solid #2b0a24; border-radius: 999px; background: #fff4ea; color: #2b0a24; padding: 5px 14px 6px 10px; font-weight: 900; font-size: 14px; box-shadow: 2px 2px 0 #2b0a24; }
html[data-theme="pink"] .toast { background: #2b0a24; color: #fff4ea; font: 800 14px Nunito, sans-serif; border-radius: 16px; box-shadow: 3px 3px 0 #ff3f8e; }
html[data-theme="pink"] .toast.err { background: #d61f55; box-shadow: 3px 3px 0 #2b0a24; }
`;

export function mount(App, root) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.isVersionAtLeast?.("6.1")) { tg.setHeaderColor("#ffd6e8"); tg.setBackgroundColor("#ffd6e8"); }
  } catch {}
  root.innerHTML = `
  <div class="cats" id="cats">
    <header class="cats-top"><div class="cats-logo">Мур<i>-</i>свет</div><div class="cats-seg" id="cats-seg"></div></header>
    <section class="cats-stage" id="cats-stage" aria-label="Кот-лампа: нажмите, чтобы включить или выключить, проведите, чтобы изменить яркость">
      <div class="cats-sky"><i class="moon"></i></div>
      <div class="cats-glow"></div>
      <div class="cats-cat">${CAT}<div class="cats-z"><i>z</i><i>z</i><i>Z</i></div></div>
      <div class="cats-status" id="cats-status"></div>
      <div id="cats-pausebox"></div>
      <div class="cats-bubble" id="cats-bubble"></div>
      <div class="cats-hint" id="cats-hint"></div>
    </section>
    <section class="cats-ctl">
      <div class="cats-tailrow"><div class="lbl">хвост<b id="cats-bv">—</b></div>
        <div class="cats-tail" id="cats-b" role="slider" aria-label="Яркость"><div class="fill"></div><div class="tip">${TIP}</div></div></div>
      <div class="cats-tabs" id="cats-tabs"><button type="button" data-t="white">Белый</button><button type="button" data-t="color">Цвет</button><button type="button" data-t="scenes">Сцены</button></div>
      <div class="cats-pane" data-p="white"><div class="cats-paws" id="cats-whites"></div>
        <div class="cats-strip" id="cats-k" role="slider" aria-label="Тепло" style="--grad:linear-gradient(90deg,#ff8a1f,#ffc27a 22%,#fff1df 45%,#f3f5ff 62%,#bcd0ff)"><div class="knob"></div></div></div>
      <div class="cats-pane" data-p="color"><div class="cats-paws" id="cats-colors"></div>
        <div class="cats-strip" id="cats-h" role="slider" aria-label="Оттенок" style="--grad:linear-gradient(90deg,#f33,#fa3,#ee3,#3e5,#3de,#36f,#a3f,#f3a,#f33)"><div class="knob"></div></div></div>
      <div class="cats-pane" data-p="scenes"><div class="cats-scenes" id="cats-scenes"></div></div>
      <nav class="cats-nav"><button type="button" data-a="modes">${ico("modes")}Режимы</button><button type="button" data-a="scenes">${ico("scenes")}Пресеты</button><button type="button" data-a="theme">${ico("theme")}Тема</button><button type="button" data-a="settings">${ico("more")}Ещё</button></nav>
    </section>
  </div>`;
  const $ = id => root.querySelector("#" + id);
  const el = $("cats"), stage = $("cats-stage"), svg = el.querySelector(".cat");
  const voice = makeVoice(App);
  const hapt = () => window.Telegram?.WebApp?.HapticFeedback;
  let tab = "white", active = null, gesture = false;
  const lit = () => !!App.S?.lamps && App.ids().some(i => App.S.lamps[i].on);
  const cur = () => App.shown() || {};
  const brightOf = l => l.mode === "scene" ? 50 : l.bright || 100;
  const put = (node, html) => { if (node._h !== html) { node._h = html; node.innerHTML = html; } };   // не пересобирать без нужды (скролл сцен)
  const timers = [];

  // ---------- отрисовка ----------
  function update() {
    const S = App.S;
    if (!S) return;
    const l = cur(), on = lit() && !S.lampsError, bright = brightOf(l);
    el.classList.toggle("sleep", !on);
    const own = App.lampRgb(l) || [255, 170, 205];
    const sides = (App.target === "both" ? S.lamps : [l, l]).map(x => App.lampRgb(x) || (on ? own : null));
    paint(sides, on ? bright : 0);
    drawSeg(); drawStatus(l, on, bright); drawControls(l, on, bright);
  }

  // мех кота — пастельный цвет ламп, тусклее при низкой яркости; спящий кот серо-сиреневый
  function paint(sides, bright) {
    const fur = sides.map(c => c ? mix(mix(c, [255, 255, 255], .3), SLEEPY, (1 - bright / 100) * .5) : SLEEPY);
    $("cats-c1").setAttribute("stop-color", App.css(fur[0]));
    $("cats-c2").setAttribute("stop-color", App.css(fur[1]));
    const glow = sides.map(c => (c || SLEEPY).join(","));
    el.style.setProperty("--g1", glow[0]); el.style.setProperty("--g2", glow[1]);
    el.style.setProperty("--gi", bright ? (.35 + .65 * bright / 100).toFixed(2) : 0);
    const main = sides[0] || SLEEPY;
    el.style.setProperty("--t1", mix(main, [255, 255, 255], .35).join(","));
    el.style.setProperty("--t2", mix(main, [43, 10, 36], .2).join(","));
    $("cats-tag").textContent = bright ? Math.round(bright) : "z";
  }

  function drawSeg() {
    const S = App.S, opts = [["both", "Обе"], [0, S.names[0]], [1, S.names[1]]];
    put($("cats-seg"), opts.map(([k, n]) => `<button type="button" data-k="${k}" class="${App.target === k ? "on" : ""}">${App.esc(n)}</button>`).join(""));
    $("cats-seg").querySelectorAll("button").forEach(b => b.onclick = () => App.setTarget(b.dataset.k === "both" ? "both" : +b.dataset.k));
  }

  const mood = b => b >= 80 ? "Сияет" : b >= 40 ? "Мурчит" : b >= 15 ? "Дремлет" : "Еле светит";
  function drawStatus(l, on, bright) {
    const S = App.S, sel = App.ids().map(i => S.lamps[i]);
    const who = App.target === "both" ? "обе лампы" : App.esc(S.names[App.target]);
    let head, sub;
    if (S.lampsError) { head = "Не достучаться"; sub = App.esc(S.lampsError); }
    else if (sel.some(x => !x.online)) { head = "Потерялся"; sub = "Не в сети: " + App.esc(sel.filter(x => !x.online).map(x => x.name).join(", ")); }
    else if (!on) { head = "Спит"; sub = "Тап — разбудить · погладь — сразу яркость"; }
    else {
      const what = l.mode === "scene" ? (l.scene === "candle" ? "Ночник" : YANDEX[l.scene] || l.scene) : l.mode === "hsv" ? `Цвет · ${bright}%` : `${l.temp} K · ${bright}%`;
      const both = App.target === "both" && sel.every(x => x.on) ? "" : App.target === "both" ? ` · горит ${App.esc(sel.find(x => x.on).name)}` : "";
      head = l.mode === "scene" ? what.split(" · ")[0] : mood(bright);
      sub = `${l.mode === "scene" ? "сцена" : what} · ${who}${both}`;
    }
    put($("cats-status"), `<b>${head}</b><small>${sub}</small>`);
    const paused = S.circ.enabled && sel.some(x => x.paused), until = Math.max(...sel.map(x => x.paused || 0));
    put($("cats-pausebox"), paused ? `<button type="button" class="cats-pause" id="cats-resume">Циркадный на паузе${until > 1 ? ` до ${App.hm(until)}` : ""}<u>вернуть</u></button>` : "");
    if (paused) $("cats-resume").onclick = e => { e.stopPropagation(); App.resume(); };
  }

  function drawControls(l, on, bright) {
    if (active !== "b") { tracks.b.show(on ? bright : 0); $("cats-bv").textContent = on ? bright + "%" : "сон"; }
    const k = l.mode === "temp" ? l.temp : tracks.k.value ?? 4000;
    if (active !== "k") tracks.k.show(k);
    const h = l.mode === "hsv" ? l.hsv.h : tracks.h.value ?? 0;
    if (active !== "h") tracks.h.show(h);
    tracks.k.knob(App.css(App.kRgb(k)));
    tracks.h.knob(App.css(App.hsvRgb(h, 100)));
    put($("cats-whites"), WHITES.map(([kk, n]) => `<button type="button" data-k="${kk}" class="${on && l.mode === "temp" && l.temp === kk ? "on" : ""}">${PAW(App.css(App.kRgb(kk)))}${n}</button>`).join(""));
    put($("cats-colors"), HUES.map(([hh, ss]) => `<button type="button" data-h="${hh}" data-s="${ss}" aria-label="Цвет" class="${on && l.mode === "hsv" && l.hsv.h === hh && l.hsv.s === ss ? "on" : ""}">${PAW(App.css(App.hsvRgb(hh, ss)))}</button>`).join(""));
    $("cats-whites").querySelectorAll("button").forEach(b => b.onclick = () => {
      const kk = +b.dataset.k, bb = cur().bright || 100;
      pick(); App.cmd("temp", {k: kk, b: bb}, {mode: "temp", temp: kk, bright: bb});
    });
    $("cats-colors").querySelectorAll("button").forEach(b => b.onclick = () => {
      const x = {h: +b.dataset.h, s: +b.dataset.s, b: cur().bright || 100};
      pick(); App.cmd("hsv", x, {mode: "hsv", hsv: {h: x.h, s: x.s, v: 100}, bright: x.b});
    });
    drawScenes(l, on);
    root.querySelectorAll(".cats-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
    root.querySelectorAll(".cats-pane").forEach(p => p.classList.toggle("on", p.dataset.p === tab));
  }
  const pick = () => { App.haptic.pick(); voice.mrrp(); wake(); };

  function items() {
    const S = App.S, dot = e => e.kind === "hsv" ? App.css(App.hsvRgb(e.value.h, e.value.s)) : e.kind === "temp" ? App.css(App.kRgb(e.value.k)) : App.SCENES[e.value]?.[2] || "#ffb35c";
    return [...SIGNATURE.map(x => ({...x, dot: x.list.length > 1 ? x.list.map(dot) : [dot(x.list[0]), dot(x.list[0])]})),
      {name: "Ночник", key: "candle", list: [{lamps: [0, 1], kind: "night", value: null}], dot: ["#ff9a3c", "#ff9a3c"]},
      ...Object.keys(YANDEX).filter(k => S.scenes?.includes(k)).map(k => ({name: YANDEX[k], key: k, list: [{lamps: [0, 1], kind: "scene", value: k}], dot: [App.SCENES[k]?.[2], App.SCENES[k]?.[2]]})),
      ...(S.presets || []).map(p => { const e = {lamps: [0, 1], kind: p.cmd.kind, value: p.cmd.value}; return {name: p.name, list: [e], dot: [dot(e), dot(e)]}; })];
  }
  function drawScenes(l, on) {
    const all = items();
    put($("cats-scenes"), all.map((it, i) => `<button type="button" class="cats-card${on && matches(it) ? " on" : ""}" data-i="${i}"><span class="heads">${HEAD(it.dot[0])}${HEAD(it.dot[1])}</span><span>${App.esc(it.name)}</span></button>`).join(""));
    $("cats-scenes").querySelectorAll("button").forEach(b => b.onclick = () => applyItem(all[+b.dataset.i]));
  }
  // карточка горит, пока выбранные лампы светят ровно так, как она задаёт
  function matches(it) {
    let seen = 0;
    for (const e of it.list) for (const i of e.lamps) {
      if (!App.ids().includes(i)) continue;
      const x = App.S.lamps[i], v = e.value; seen++;
      const ok = x.on && (e.kind === "hsv" ? x.mode === "hsv" && x.hsv.h === v.h && x.hsv.s === v.s
        : e.kind === "temp" ? x.mode === "temp" && x.temp === v.k : x.mode === "scene" && x.scene === (e.kind === "night" ? "candle" : v));
      if (!ok) return false;
    }
    return seen > 0;
  }
  function applyItem(it) {
    let list = it.list;
    if (App.target !== "both") {   // сцена на одну лампу: берём цвет, заданный для этой лампы
      const t = App.target, x = list.find(e => e.lamps.includes(t)) || list[0];
      list = [{...x, lamps: [t]}];
    }
    App.haptic.tap(); voice.mrrp(); wake();
    App.scene(list.map(x => ({...x, patch: patchOf(x.kind, x.value)})));
  }

  // ---------- ползунки: хвост (яркость) и полоски (тепло, оттенок) ----------
  // картинка меняется под пальцем, команда уходит одна — когда палец отпущен
  function track(id, key, min, max, step, onMove, onCommit) {
    const box = $(id);
    const t = {value: null,
      show(v) { t.value = v; box.style.setProperty("--p", Math.max(0, Math.min(1, (v - min) / (max - min))).toFixed(4)); },
      knob(c) { const k = box.querySelector(".knob"); if (k) put(k, HEAD(c)); }};
    let last = null;
    const at = e => {
      const r = box.getBoundingClientRect(), pad = 18;
      const p = Math.max(0, Math.min(1, (e.clientX - r.left - pad) / (r.width - 2 * pad)));
      const v = Math.round((min + p * (max - min)) / step) * step;
      t.show(v);
      const tick = Math.round(v / (step * 5));
      if (tick !== last) { last = tick; App.sound.tick(); App.haptic.pick(); }
      onMove(v);
    };
    box.addEventListener("pointerdown", e => {
      if (!App.S?.lamps) return;
      box.setPointerCapture(e.pointerId); active = key; App.dragging = true; last = null; at(e);
    });
    box.addEventListener("pointermove", e => { if (active === key) at(e); });
    const up = () => { if (active !== key) return; active = null; App.dragging = false; onCommit(t.value); };
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    return t;
  }
  const tracks = {
    b: track("cats-b", "b", 1, 100, 1, v => { $("cats-bv").textContent = v + "%"; App.preview({bright: v}); },
      v => { wake(); App.cmd("bright", v, {bright: v}); }),
    k: track("cats-k", "k", 1500, 9000, 100, v => { tracks.k.knob(App.css(App.kRgb(v))); App.preview({mode: "temp", temp: v}); },
      v => { const b = cur().bright || 100; App.cmd("temp", {k: v, b}, {mode: "temp", temp: v, bright: b}); }),
    h: track("cats-h", "h", 0, 359, 1, v => { tracks.h.knob(App.css(App.hsvRgb(v, 100))); App.preview({mode: "hsv", hsv: {h: v, s: hsS(), v: 100}}); },
      v => { const x = {h: v, s: hsS(), b: cur().bright || 100}; App.cmd("hsv", x, {mode: "hsv", hsv: {h: x.h, s: x.s, v: 100}, bright: x.b}); }),
  };
  const hsS = () => { const l = cur(); return l.mode === "hsv" && l.hsv.s >= 30 ? l.hsv.s : 100; };

  root.querySelectorAll(".cats-tabs button").forEach(b => b.onclick = () => { tab = b.dataset.t; App.haptic.pick(); App.sound.pick(); App.store.set("catsTab", tab); update(); });
  root.querySelectorAll(".cats-nav button").forEach(b => b.onclick = () => {
    App.haptic.pick();
    ({modes: App.openModes, scenes: () => App.openScenes("Пресеты"), theme: App.openThemes, settings: App.openSettings})[b.dataset.a]();
  });
  App.store.get("catsTab").then(t => { if (["white", "color", "scenes"].includes(t)) { tab = t; update(); } });

  // ---------- кот: тап — вкл/выкл, погладить — яркость (кот мурчит), глаза следят за пальцем ----------
  function wake() { el.classList.remove("wake"); void el.offsetWidth; el.classList.add("wake"); }
  function toggle() {
    if (!App.S?.lamps) return;
    App.haptic.tap();
    const on = lit();
    App.cmd(on ? "off" : "on");
    if (!on) { wake(); voice.purr(true); timers.push(setTimeout(() => { if (!gesture) voice.purr(false); }, 900)); }
  }

  let down = null;
  stage.addEventListener("pointerdown", e => {
    if (e.target.closest("button") || !App.S?.lamps) return;
    stage.setPointerCapture(e.pointerId);
    const on = lit();
    down = {x: e.clientX, y: e.clientY, t: performance.now(), mode: null, on, b0: on ? brightOf(cur()) : 0, v: null, hx: e.clientX, hy: e.clientY};
  });
  stage.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.mode && Math.hypot(dx, dy) > 10) {
      down.mode = "pet"; gesture = true; App.dragging = true;
      el.classList.add("purr"); voice.purr(true); purrBeat();
      $("cats-hint").style.opacity = 0;
    }
    if (down.mode !== "pet") return;
    const s = Math.abs(dy) >= Math.abs(dx) ? -dy : dx;   // вверх или вправо — ярче
    const v = Math.round(Math.min(100, Math.max(1, down.b0 + s / stage.clientHeight * 150)));
    if (v !== down.v) {
      if (down.tv == null || Math.abs(v - down.tv) >= 5) { App.sound.tick(); App.haptic.pick(); down.tv = v; }
      down.v = v;
      if (down.on || v > 1) App.preview({bright: v});
    }
    $("cats-bubble").textContent = down.on || v > 1 ? v + "%" : "zzz";
    $("cats-bubble").classList.add("on");
    if (Math.hypot(e.clientX - down.hx, e.clientY - down.hy) > 28) { heart(e); down.hx = e.clientX; down.hy = e.clientY; }
  });
  const end = e => {
    if (!down) return;
    const d = down; down = null; gesture = false; App.dragging = false;
    el.classList.remove("purr"); voice.purr(false); clearTimeout(purrBeat.t);
    $("cats-bubble").classList.remove("on");
    if (d.mode === "pet") { if (d.v != null && (d.on || d.v > 1)) { if (!d.on) wake(); App.cmd("bright", d.v, {bright: d.v}); } return; }
    if (e.type === "pointerup" && performance.now() - d.t < 450) toggle();
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  // мурчание чувствуется и рукой: мягкие толчки вибрации, пока гладят
  function purrBeat() { hapt()?.impactOccurred("soft"); purrBeat.t = setTimeout(purrBeat, 230); }
  function heart(e) {
    const r = stage.getBoundingClientRect(), h = document.createElement("i");
    h.className = "cats-heart"; h.textContent = "♥";
    h.style.left = e.clientX - r.left + "px"; h.style.top = e.clientY - r.top + "px"; h.style.setProperty("--r", (Math.random() * 40 - 20) + "deg");
    stage.appendChild(h); setTimeout(() => h.remove(), 1000);
  }

  // глаза: зрачки смотрят на палец где угодно на экране, без пальца — оглядываются и моргают
  const EYES = [[118, 113], [182, 113]], pupils = [$("cats-p1"), $("cats-p2")];
  let lookAt = 0;
  function look(x, y) {
    const r = svg.getBoundingClientRect(), s = r.width / 300;
    if (!s) return;
    EYES.forEach(([ex, ey], i) => {
      const dx = x - (r.left + ex * s), dy = y - (r.top + ey * s), d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / (90 * s));
      pupils[i].style.transform = `translate(${(dx / d * 6 * m).toFixed(1)}px, ${(dy / d * 5.5 * m).toFixed(1)}px)`;
    });
  }
  const follow = e => { lookAt = performance.now(); look(e.clientX, e.clientY); };
  el.addEventListener("pointermove", follow, {passive: true});
  el.addEventListener("pointerdown", follow, {passive: true});
  const idle = setInterval(() => {
    if (document.hidden || el.classList.contains("sleep")) return;
    if (performance.now() - lookAt > 2500) {
      const r = svg.getBoundingClientRect();
      Math.random() < .35 ? pupils.forEach(p => p.style.transform = "") : look(r.left + r.width * Math.random(), r.top + r.height * (.15 + .7 * Math.random()));
    }
    if (Math.random() < .45) { el.classList.add("blink"); setTimeout(() => el.classList.remove("blink"), 140); }
  }, 1700);

  App.store.get("catsHint").then(seen => {
    if (seen === "1") return;
    $("cats-hint").textContent = "тап — свет · гладь ↕ — ярче/тусклее";
    timers.push(setTimeout(() => { $("cats-hint").style.opacity = 0; App.store.set("catsHint", "1"); }, 7000));
  });

  return {update, unmount() { clearInterval(idle); timers.forEach(clearTimeout); clearTimeout(purrBeat.t); voice.close(); style.remove(); root.innerHTML = ""; }};
}

// ---------- голос кота: мурчание и «мрр» синтезируются WebAudio, молчат, если звуки выключены в настройках ----------
function makeVoice(App) {
  let ctx = null, buf = null, purring = null;
  const ac = () => {
    if (!App.sound.enabled) return null;
    try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); } catch { ctx = null; }
    return ctx;
  };
  // 2,4 с настоящего ритма мурчания: вдох (27 Гц, тише) и выдох (23 Гц, громче), каждый удар — короткая вспышка шума
  function purrBuffer(c) {
    if (buf) return buf;
    const sr = c.sampleRate, n = Math.floor(sr * 2.4), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
    let ph = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, inhale = t < 1.1;
      ph += (inhale ? 27 : 23) / sr;
      const p = ph % 1, burst = p < .6 ? Math.sin(Math.PI * p / .6) ** 2 : 0;
      const breath = inhale ? .55 * Math.sin(Math.PI * t / 1.1) : Math.sin(Math.PI * (t - 1.1) / 1.3);
      lp += (Math.random() * 2 - 1 - lp) * .14;
      d[i] = lp * burst * Math.max(0, breath) * 2.4;
    }
    return buf = b;
  }
  return {
    purr(on) {
      if (!on) {
        if (!purring) return;
        const p = purring; purring = null;
        p.g.gain.setTargetAtTime(0, p.c.currentTime, .09);
        setTimeout(() => { try { p.src.stop(); } catch {} }, 500);
        return;
      }
      const c = ac();
      if (!c || purring) return;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = purrBuffer(c); src.loop = true;
      f.type = "lowpass"; f.frequency.value = 1100; f.Q.value = .7;
      g.gain.setValueAtTime(0, c.currentTime); g.gain.setTargetAtTime(.3, c.currentTime, .12);
      src.connect(f).connect(g).connect(c.destination); src.start();
      purring = {src, g, c};
    },
    mrrp() {   // короткое вопросительное «мрр?» с трелью
      const c = ac();
      if (!c) return;
      const t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), tr = c.createOscillator(), tg = c.createGain();
      o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 1500;
      o.frequency.setValueAtTime(390, t); o.frequency.linearRampToValueAtTime(640, t + .1); o.frequency.linearRampToValueAtTime(540, t + .22);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.045, t + .03); g.gain.exponentialRampToValueAtTime(.0005, t + .26);
      tr.frequency.value = 30; tg.gain.value = .018; tr.connect(tg).connect(g.gain);
      o.connect(f).connect(g).connect(c.destination);
      o.start(t); tr.start(t); o.stop(t + .3); tr.stop(t + .3);
    },
    close() { this.purr(false); setTimeout(() => ctx?.close().catch(() => {}), 600); },
  };
}
