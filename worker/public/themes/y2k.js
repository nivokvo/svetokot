// Y2K-тема Светокота: своя раскладка поверх общего ядра Mini App (window.App в app.html).
// Гибрид, как делали в 2000-х: хром заранее отрендерен в WebP (tools/y2k-sprites.py), а движение — на CSS.
// Сверху — сцена: хромовая лампочка с крыльями из перьев (веер раскрывается волной), звёзды крутятся в 3D, параллакс пальцем.
// Снизу — прозрачный пластиковый «гаджет»: ЖК-экран, колесо как у iPod и стеклянные кнопки-пузыри.

const SPRITE = name => new URL(`./y2k/${name}.webp`, import.meta.url).href;
const ASPECT = {feather1: 6.2732, feather2: 4.0212, feather3: 2.5902, star: 1.1258, bulb: 1.8364};

// Фирменные сцены темы: у двух ламп разные цвета (палитра постеров 2000-х: ультрамарин, ледяной, фиолет, оранжевый).
const SIGNATURE = [
  {name: "ICE ANGEL", list: [{lamps: [0, 1], kind: "hsv", value: {h: 205, s: 35, b: 85}}]},
  {name: "ULTRAVIOLET", list: [{lamps: [0], kind: "hsv", value: {h: 262, s: 100, b: 70}}, {lamps: [1], kind: "hsv", value: {h: 292, s: 85, b: 70}}]},
  {name: "2000 DUO", list: [{lamps: [0], kind: "hsv", value: {h: 228, s: 95, b: 80}}, {lamps: [1], kind: "hsv", value: {h: 22, s: 95, b: 80}}]},
  {name: "CYBER", list: [{lamps: [0], kind: "hsv", value: {h: 185, s: 100, b: 75}}, {lamps: [1], kind: "hsv", value: {h: 315, s: 90, b: 75}}]},
  {name: "CHROME", list: [{lamps: [0, 1], kind: "temp", value: {k: 7000, b: 100}}]},
];
const YANDEX = {ocean: "OCEAN", romance: "ROMANCE", night: "NIGHT", dinner: "DINNER", garland: "GARLAND", rest: "REST"};
const PARAMS = [["bright", "BRIGHT"], ["warm", "WARM"], ["hue", "HUE"]];
const STEP_DEG = 12;   // один щелчок колеса
// Ряды перьев: маховые, второстепенные, кроющие. Углы — от «вверх» по часовой: сложено (вниз вдоль колбы) → раскрыто веером.
const ROWS = [
  {n: 9, sprite: "feather1", len: [1, .6], h: .42, folded: [170, 152], open: [-10, 108], dx: 0, dy: 0},
  {n: 8, sprite: "feather2", len: [1, .66], h: .27, folded: [166, 146], open: [4, 116], dx: 3, dy: 5},
  {n: 6, sprite: "feather3", len: [1, .76], h: .16, folded: [160, 140], open: [20, 126], dx: 6, dy: 10},
];
const STARS = [[.12, .1, 34, 0], [.86, .2, 24, 1.2], [.08, .62, 22, 2.1], [.9, .66, 30, .6], [.72, .04, 16, 1.8]];

const patchOf = (kind, v) => kind === "hsv" ? {mode: "hsv", hsv: {h: v.h, s: v.s, v: 100}, bright: v.b || 100}
  : kind === "temp" ? {mode: "temp", temp: v.k, bright: v.b || 100} : {mode: "scene", scene: kind === "night" ? "candle" : v};

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800;900&family=VT323&display=swap");
html[data-theme="y2k"] { --bg: #05050b; --text: #eef2ff; --hint: #8f97c2; --accent: #4a63ff; --accent-text: #fff; --danger: #ff5c8a;
  --card: rgba(160,180,255,.07); --card2: rgba(160,180,255,.13); --line: rgba(160,180,255,.18); }
html[data-theme="y2k"] body { padding: 0; background: #030308; overflow: hidden; }
.y2k { --lamp: 140,160,255; --c1: var(--lamp); --c2: var(--lamp); --lit: 0;
  position: relative; height: var(--tg-viewport-stable-height, 100dvh); min-height: 520px; display: flex; flex-direction: column;
  color: #eef2ff; font-family: -apple-system, system-ui, sans-serif; overflow: hidden; user-select: none; -webkit-user-select: none; }
.y2k * { box-sizing: border-box; }
.y2k img { -webkit-user-drag: none; pointer-events: none; }
.y2k-bg { position: absolute; inset: 0; pointer-events: none; transition: background .6s;
  background: radial-gradient(90% 55% at 50% 30%, rgba(var(--lamp), calc(.05 + .28 * var(--lit))) 0%, transparent 70%),
              radial-gradient(70% 40% at 50% 100%, rgba(74,99,255,.28), transparent 70%), #030308; }
.y2k-scan { position: absolute; inset: 0; pointer-events: none; z-index: 20; opacity: .12;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0 1px, transparent 1px 3px); }

.y2k-top { position: relative; z-index: 6; flex: 0 0 auto; padding: 10px 16px 0; display: flex; justify-content: space-between; align-items: flex-start; }
.y2k-meta { font: 14px/1 VT323, monospace; letter-spacing: 1px; color: #9fb2ff; text-transform: uppercase; }
.y2k-meta b { color: #ff7a2f; font-weight: 400; }
.y2k-title { position: relative; font: 900 24px/1 Unbounded, sans-serif; letter-spacing: -.5px; margin: 3px 0 0;
  background: linear-gradient(180deg, #fff 0%, #dfe5f2 38%, #6f7686 50%, #f4f6fb 62%, #a8afbd 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 8px rgba(120,150,255,.35)); }
.y2k-title::before, .y2k-title::after { content: attr(data-text); position: absolute; inset: 0; opacity: 0; -webkit-text-fill-color: currentColor; }
.y2k.glitching .y2k-title::before { opacity: .85; color: #00f0ff; transform: translate(-3px, 0); clip-path: inset(10% 0 55% 0); }
.y2k.glitching .y2k-title::after { opacity: .85; color: #ff2ab4; transform: translate(3px, 1px); clip-path: inset(55% 0 8% 0); }
.y2k-barcode { width: 58px; height: 22px; margin: 2px 0 0 auto; opacity: .8;
  background: repeating-linear-gradient(90deg, #dfe5ff 0 2px, transparent 2px 3px, #dfe5ff 3px 4px, transparent 4px 7px, #dfe5ff 7px 10px, transparent 10px 11px); }

/* ---------- сцена ---------- */
.y2k-hero { position: relative; flex: 1 1 auto; min-height: 210px; perspective: 800px; touch-action: none; cursor: grab; }
.y2k-floor { position: absolute; left: -40%; right: -40%; bottom: -6%; height: 46%; transform: rotateX(72deg); transform-origin: 50% 100%; pointer-events: none;
  background: linear-gradient(transparent, rgba(var(--lamp), calc(.12 + .2 * var(--lit)))),
              repeating-linear-gradient(90deg, rgba(150,175,255,.35) 0 1px, transparent 1px 34px),
              repeating-linear-gradient(0deg, rgba(150,175,255,.35) 0 1px, transparent 1px 34px);
  -webkit-mask: linear-gradient(transparent, #000 40%); mask: linear-gradient(transparent, #000 40%); animation: floor 3.2s linear infinite; }
@keyframes floor { to { background-position: 0 0, 0 0, 0 34px; } }
.y2k-vert { position: absolute; right: 8px; top: 6%; z-index: 4; writing-mode: vertical-rl; font: 14px/1.1 "Hiragino Sans", "Noto Sans JP", sans-serif;
  letter-spacing: 5px; color: rgba(210,222,255,.5); pointer-events: none; text-shadow: 0 0 8px rgba(120,150,255,.6); }
.y2k-sway { position: absolute; inset: 0; transform-style: preserve-3d; animation: sway 9s ease-in-out infinite; }
@keyframes sway { 0%, 100% { transform: rotateY(-5deg) translateY(0); } 50% { transform: rotateY(5deg) translateY(-6px); } }
.y2k-rig { position: absolute; inset: 0; transform-style: preserve-3d; transform: rotateY(var(--yaw, 0deg)) rotateX(var(--pitch, 0deg)); }
.y2k-arch { position: absolute; left: 50%; top: 4%; height: 84%; aspect-ratio: .7; transform: translateX(-50%) translateZ(-70px);
  border-radius: 999px 999px 16px 16px; overflow: hidden; opacity: calc(.15 + .75 * var(--lit)); transition: opacity .8s;
  box-shadow: 0 0 0 3px #c9cfdc, 0 0 0 5px #5d6372, 0 0 0 7px #eef1f7, 0 0 50px rgba(var(--lamp), calc(.55 * var(--lit))); }
.y2k-arch svg { position: absolute; inset: -20%; width: 140%; height: 140%; animation: drift 40s linear infinite alternate; }
.y2k-arch::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(var(--lamp), .55), rgba(10,14,40,.25) 75%); mix-blend-mode: color; }
@keyframes drift { to { transform: translate(-12%, 4%); } }
.y2k-bigstar { position: absolute; left: 50%; top: 36%; width: 62%; transform: translate(-50%, -50%) translateZ(-110px); opacity: calc(.06 + .34 * var(--lit)); }
.y2k-bigstar img { width: 100%; animation: spin2d 60s linear infinite; }
@keyframes spin2d { to { transform: rotate(360deg); } }
.y2k-star { position: absolute; transform-style: preserve-3d; }
.y2k-star img { width: 100%; display: block; animation: spin3d var(--d, 7s) linear infinite, bob 4s ease-in-out infinite alternate;
  filter: drop-shadow(0 0 6px rgba(var(--lamp), calc(.3 + .6 * var(--lit)))); }
@keyframes spin3d { to { transform: rotateY(360deg); } }
@keyframes bob { to { translate: 0 -8px; } }
.y2k-spark { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #fff; box-shadow: 0 0 6px 1px rgba(var(--lamp), .9);
  animation: twinkle var(--d) ease-in-out infinite; animation-delay: var(--dl); pointer-events: none; }
@keyframes twinkle { 0%, 100% { opacity: .1; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.3); } }

.y2k-figure { position: absolute; left: 50%; bottom: 13%; transform: translateX(-50%); transform-style: preserve-3d; }
.y2k-wing { position: absolute; width: 0; height: 0; transform-style: preserve-3d; transition: filter .6s; }
.y2k-wing.l { filter: drop-shadow(0 0 7px rgba(var(--c1), calc(.15 + .75 * var(--lit)))); }
.y2k-wing.r { filter: drop-shadow(0 0 7px rgba(var(--c2), calc(.15 + .75 * var(--lit)))); }
.y2k-flap { position: absolute; transform-origin: 0 0; }
.y2k.lit .y2k-flap { animation: flap 2.6s ease-in-out infinite; }
@keyframes flap { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-5deg); } }
.y2k-feather { position: absolute; left: 0; bottom: 0; transform-origin: 50% 100%; transition: transform .9s cubic-bezier(.2, .9, .25, 1.12); }
.y2k-bulb { position: absolute; left: 0; bottom: 0; transform: translateX(-50%) translateZ(30px); isolation: isolate; transition: transform .15s; }
.y2k-bulb.press { transform: translateX(-50%) translateZ(30px) scale(.95); }
.y2k-bulb img, .y2k-bulb .tint { position: absolute; inset: 0; width: 100%; height: 100%; }
.y2k-bulb .on, .y2k-bulb .tint { opacity: var(--lit); transition: opacity .5s; }
.y2k-bulb .tint { background: radial-gradient(circle at 50% 32%, #fff 0%, rgb(var(--lamp)) 46%, rgb(var(--lamp)) 100%); mix-blend-mode: multiply;
  -webkit-mask: var(--mask) center / 100% 100% no-repeat; mask: var(--mask) center / 100% 100% no-repeat; }
.y2k-halo { position: absolute; left: 50%; top: 30%; width: 260%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgba(var(--lamp), .85) 0%, rgba(var(--lamp), .35) 22%, transparent 60%); opacity: calc(var(--lit) * .9); transition: opacity .6s, background .6s; z-index: -1; }
.y2k-flare { position: absolute; left: 50%; top: 30%; width: 420%; height: 3px; transform: translate(-50%, -50%); pointer-events: none; opacity: calc(var(--lit) * .85);
  background: linear-gradient(90deg, transparent, rgba(var(--lamp), .7) 30%, #fff 50%, rgba(var(--lamp), .7) 70%, transparent); filter: blur(1px); transition: opacity .6s; }
.y2k-flare::after { content: ""; position: absolute; left: 50%; top: 50%; width: 30%; height: 30px; transform: translate(-50%, -50%);
  background: radial-gradient(ellipse, rgba(255,255,255,.6), transparent 70%); }
.y2k-hint { position: absolute; left: 0; right: 0; bottom: 48px; z-index: 6; text-align: center; pointer-events: none;
  font: 15px VT323, monospace; letter-spacing: 2px; color: rgba(220,230,255,.7); text-transform: uppercase; }
.y2k-pills { position: absolute; left: 0; right: 0; bottom: 8px; z-index: 6; display: flex; justify-content: center; gap: 8px; }
.y2k-pill { border: 0; border-radius: 999px; padding: 7px 14px; font: 800 11px Unbounded, sans-serif; letter-spacing: .5px; color: #20232c; cursor: pointer;
  background: linear-gradient(180deg, #ffffff 0%, #d9dde7 42%, #858b99 50%, #e6e9f0 100%);
  box-shadow: inset 0 1px 0 #fff, inset 0 -2px 3px rgba(0,0,0,.25), 0 4px 14px rgba(0,0,0,.5); transition: transform .15s, box-shadow .25s; }
.y2k-pill:active { transform: scale(.92); }
.y2k-pill.on { color: #fff; background: linear-gradient(180deg, #8ea0ff 0%, #4a63ff 45%, #1f2fd1 52%, #5b72ff 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 0 18px rgba(74,99,255,.9), 0 4px 14px rgba(0,0,0,.5); }

/* ---------- гаджет: полупрозрачный пластик, как Game Boy Color «Atomic» и iMac G3 ---------- */
.y2k-device { position: relative; z-index: 6; flex: 0 0 auto; margin: 6px 10px calc(10px + env(safe-area-inset-bottom)); padding: 10px 12px 12px;
  border-radius: 30px 30px 44px 44px; backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3);
  background: linear-gradient(165deg, rgba(170,195,255,.30), rgba(70,95,220,.16) 55%, rgba(120,90,255,.22)),
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cg fill='none' stroke='%23b8c8ff' stroke-opacity='.16' stroke-width='1.2'%3E%3Cpath d='M0 20h30l10 10h50M20 0v12l8 8M60 90V64l10-10h20M0 70h18l12-12v-14'/%3E%3C/g%3E%3Cg fill='%23b8c8ff' fill-opacity='.22'%3E%3Ccircle cx='30' cy='20' r='2'/%3E%3Ccircle cx='60' cy='64' r='2'/%3E%3Ccircle cx='30' cy='44' r='2'/%3E%3C/g%3E%3C/svg%3E");
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 0 0 1px rgba(200,215,255,.28), inset 0 -10px 30px rgba(40,60,200,.25), 0 14px 40px rgba(0,0,0,.6); }
.y2k-lcd { border-radius: 14px; padding: 7px 11px 6px; position: relative; overflow: hidden; cursor: pointer;
  background: linear-gradient(180deg, #0e1f5c, #07103a); color: #a9d6ff; font: 18px/1.05 VT323, monospace; letter-spacing: 1px;
  box-shadow: inset 0 0 0 2px rgba(169,214,255,.25), inset 0 0 26px rgba(0,0,0,.6), 0 0 0 2px #c9cfdc, 0 0 0 4px #4d5262; text-shadow: 0 0 6px rgba(120,190,255,.8); }
.y2k-lcd::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 1px, transparent 1px 3px); }
.y2k-lcd .r { display: flex; justify-content: space-between; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; }
.y2k-lcd .big { font-size: 28px; line-height: 1; }
.y2k-lcd .bar { display: flex; gap: 3px; margin: 4px 0; }
.y2k-lcd .bar i { flex: 1; height: 8px; background: rgba(169,214,255,.18); }
.y2k-lcd .bar i.on { background: #a9d6ff; box-shadow: 0 0 6px #6fb8ff; }
.y2k-lcd .dim { opacity: .65; font-size: 16px; }
.y2k-lcd.flash { animation: lcdflash .35s; }
@keyframes lcdflash { 30% { background: linear-gradient(180deg, #2a4bb0, #13288a); } }
.y2k-cat { width: 30px; height: 22px; image-rendering: pixelated; }
.y2k-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
.y2k-orbs { display: grid; gap: 10px; }
.y2k-orb { position: relative; border: 0; background: none; padding: 0; cursor: pointer; display: grid; justify-items: center; gap: 2px;
  font: 500 9px Unbounded, sans-serif; color: #dfe6ff; letter-spacing: .2px; }
.y2k-orb .ball { position: relative; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; transition: transform .15s;
  background: radial-gradient(circle at 50% 75%, #9fd0ff 0%, #4f7dff 38%, #1d2fb8 72%, #0b1460 100%);
  box-shadow: inset 0 -3px 8px rgba(160,220,255,.6), inset 0 2px 2px rgba(255,255,255,.4), 0 0 14px rgba(80,120,255,.55), 0 4px 10px rgba(0,0,0,.5); }
.y2k-orb .ball::before { content: ""; position: absolute; left: 18%; right: 18%; top: 6%; height: 42%; border-radius: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.05)); }
.y2k-orb:active .ball { transform: scale(.88); }
.y2k-orb svg { position: relative; width: 22px; height: 22px; }

.y2k-wheel { position: relative; width: min(170px, 23vh, 44vw); aspect-ratio: 1; border-radius: 50%; touch-action: none; }
.y2k-ring { position: absolute; inset: 0; border-radius: 50%; transform: rotate(var(--rot, 0deg));
  background: conic-gradient(from 10deg, #f6f7fb, #9aa0ad 12%, #ffffff 24%, #7b818e 37%, #eef0f5 50%, #8d93a0 62%, #ffffff 75%, #858b98 88%, #f6f7fb);
  box-shadow: inset 0 2px 2px #fff, inset 0 -6px 14px rgba(0,0,0,.35), 0 12px 28px rgba(0,0,0,.6), 0 0 0 1px #3d414c, 0 0 40px rgba(var(--lamp), calc(.45 * var(--lit))); }
.y2k-wheel .lbl { position: absolute; font: 800 10px Unbounded, sans-serif; color: #3a3e49; letter-spacing: 1px; pointer-events: none; text-shadow: 0 1px 0 rgba(255,255,255,.7); }
.y2k-wheel .lbl svg { display: block; }
.y2k-wheel .t { left: 50%; top: 8%; transform: translateX(-50%); }
.y2k-wheel .b { left: 50%; bottom: 8%; transform: translateX(-50%); }
.y2k-wheel .l { left: 8%; top: 50%; transform: translateY(-50%); }
.y2k-wheel .rr { right: 8%; top: 50%; transform: translateY(-50%); }
.y2k-wheel .fl { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; opacity: 0; }
.y2k-wheel .fl.go { animation: quad .4s ease-out; }
@keyframes quad { 0% { opacity: .95; } 100% { opacity: 0; } }
.y2k-wheel .dot { position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px; border-radius: 50%; pointer-events: none;
  background: rgb(var(--lamp)); box-shadow: 0 0 10px rgb(var(--lamp)); opacity: calc(.25 + .75 * var(--lit)); }
.y2k-center { position: absolute; left: 50%; top: 50%; width: 38%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; border: 0; cursor: pointer;
  background: radial-gradient(circle at 35% 28%, #ffffff 0%, #e3e6ee 30%, #8b919e 70%, #c9ccd6 100%);
  box-shadow: inset 0 -4px 8px rgba(0,0,0,.35), 0 4px 10px rgba(0,0,0,.45), 0 0 0 4px rgba(0,0,0,.15); display: grid; place-items: center; transition: transform .12s; }
.y2k-center:active { transform: translate(-50%, -50%) scale(.92); }
.y2k-center .led { width: 30%; aspect-ratio: 1; border-radius: 50%; background: #2a2d36; box-shadow: inset 0 1px 3px rgba(0,0,0,.6); transition: background .4s, box-shadow .4s; }
.y2k.lit .y2k-center .led { background: rgb(var(--lamp)); box-shadow: 0 0 14px rgb(var(--lamp)), 0 0 30px rgba(var(--lamp), .7), inset 0 1px 2px rgba(255,255,255,.7); }

/* загрузка: всё, кроме экрана, проявляется, когда спрайты готовы */
.y2k.booting .y2k-hero, .y2k.booting .y2k-row { opacity: 0; }
.y2k .y2k-hero, .y2k .y2k-row { transition: opacity .5s; }

/* окна 2000-х: шторка ядра получает хромовую шапку */
html[data-theme="y2k"] .sheet { background: rgba(2,3,10,.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
html[data-theme="y2k"] .sheet-card { background: rgba(10,12,26,.95); border-radius: 18px 18px 0 0; padding-top: 0;
  box-shadow: 0 0 0 1px rgba(200,210,255,.25), 0 -10px 40px rgba(74,99,255,.25); animation: winopen .35s cubic-bezier(.2,.9,.3,1.15); }
html[data-theme="y2k"] .sheet-head { margin: 0 -16px 10px; padding: 10px 16px; border-radius: 18px 18px 0 0;
  background: linear-gradient(180deg, #f4f6fb 0%, #c7ccd8 48%, #8c92a0 52%, #d9dde6 100%); color: #1c1f28; }
html[data-theme="y2k"] .sheet-head b { font: 800 13px Unbounded, sans-serif; text-transform: lowercase; }
html[data-theme="y2k"] .sheet-head b::after { content: ".exe"; opacity: .55; }
html[data-theme="y2k"] .sheet-x { background: linear-gradient(180deg, #ff9a7a, #e8432a); color: #fff; width: 24px; height: 24px; font-size: 15px; line-height: 1;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(0,0,0,.4); }
html[data-theme="y2k"] .sheet .card { border: 1px solid rgba(160,180,255,.14); }
html[data-theme="y2k"] .toast { background: linear-gradient(180deg, #8ea0ff, #3b54ff); color: #fff; font-family: Unbounded, sans-serif; font-size: 12px; }
@keyframes winopen { from { transform: translateY(30px) scale(.94); opacity: 0; filter: hue-rotate(90deg) blur(4px); } }
@media (prefers-reduced-motion: reduce) { .y2k *, .y2k *::before { animation: none !important; transition: none !important; } }
`;

const CAT_UP = ["..X......X..", ".XX......XX.", ".XXXXXXXXXX.", "XXXXXXXXXXXX", "XX..XXXX..XX", "XXXXXXXXXXXX", "XXXXX..XXXXX", ".XXXXXXXXXX.", "..XX....XX.."];
const CAT_ZZ = ["............", "..X......X..", ".XXXXXXXXXX.", "XXXXXXXXXXXX", "XX--XXXX--XX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", ".XXXXXXXXXXX", "..XXXXXXXXX."];
const catSvg = rows => `<svg class="y2k-cat" viewBox="0 0 12 9" fill="#a9d6ff">${rows.flatMap((r, y) => [...r].map((c, x) => c === "X" ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : "")).join("")}</svg>`;
const ICON = paths => `<svg viewBox="0 0 32 32" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export function mount(App, root) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const sparks = Array.from({length: 14}, () => `<i class="y2k-spark" style="left:${(Math.random() * 96).toFixed(1)}%;top:${(Math.random() * 80).toFixed(1)}%;--d:${(2 + Math.random() * 3).toFixed(1)}s;--dl:-${(Math.random() * 4).toFixed(1)}s"></i>`).join("");
  root.innerHTML = `
  <div class="y2k booting" id="y2k">
    <svg width="0" height="0" style="position:absolute"><defs>
      <filter id="clouds" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="4" seed="7"/>
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -.55"/></filter>
    </defs></svg>
    <div class="y2k-bg"></div>
    <header class="y2k-top">
      <div><div class="y2k-meta">new millennium <b>✦</b> new light</div><h1 class="y2k-title" data-text="СВЕТОКОТ">СВЕТОКОТ</h1></div>
      <div style="text-align:right"><div class="y2k-meta">vol. 2000</div><div class="y2k-barcode"></div></div>
    </header>
    <section class="y2k-hero" id="y2k-hero">
      <div class="y2k-floor"></div>
      <div class="y2k-sway"><div class="y2k-rig" id="y2k-rig">
        <div class="y2k-arch"><svg viewBox="0 0 400 520" preserveAspectRatio="none"><rect width="400" height="520" fill="#1d2f7a"/><rect width="400" height="520" filter="url(#clouds)"/></svg></div>
        <div class="y2k-bigstar"><img src="${SPRITE("star")}" alt=""></div>
        ${sparks}
        <div class="y2k-figure" id="y2k-figure">
          <div class="y2k-wing l" id="y2k-wl"><div class="y2k-flap"></div></div>
          <div class="y2k-wing r" id="y2k-wr"><div class="y2k-flap"></div></div>
          <div class="y2k-bulb" id="y2k-bulb">
            <div class="y2k-halo"></div>
            <img class="off" src="${SPRITE("bulbOff")}" alt="">
            <img class="on" src="${SPRITE("bulbOn")}" alt="">
            <div class="tint" style="--mask:url('${SPRITE("bulbMask")}')"></div>
            <div class="y2k-flare"></div>
          </div>
        </div>
        ${STARS.map(([x, y, s, dl], i) => `<div class="y2k-star" style="left:${x * 100}%;top:${y * 100}%;width:${s}px;transform:translateZ(${40 + i * 12}px)"><img src="${SPRITE("star")}" alt="" style="--d:${5 + i * 1.3}s;animation-delay:-${dl}s,-${dl}s"></div>`).join("")}
      </div></div>
      <div class="y2k-vert">光の猫 ✦ 二〇〇〇 ✦ 寝室</div>
      <div class="y2k-hint" id="y2k-hint"></div>
      <div class="y2k-pills" id="y2k-pills"></div>
    </section>
    <section class="y2k-device">
      <div class="y2k-lcd" id="y2k-lcd" role="button" aria-label="Сменить, что крутит колесо"></div>
      <div class="y2k-row">
        <div class="y2k-orbs">
          <button type="button" class="y2k-orb" data-a="modes"><span class="ball">${ICON('<circle cx="16" cy="16" r="5.5"/><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2 2M22.5 22.5l2 2M7.5 24.5l2-2M22.5 9.5l2-2"/>')}</span>Режимы</button>
          <button type="button" class="y2k-orb" data-a="scenes"><span class="ball">${ICON('<path d="M16 4l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/>')}</span>Сцены</button>
        </div>
        <div class="y2k-wheel" id="y2k-wheel" aria-label="Колесо">
          <div class="y2k-ring" id="y2k-ring"></div>
          <div class="fl" id="y2k-fl"></div>
          <span class="lbl t">MENU</span>
          <span class="lbl l"><svg width="20" height="12" viewBox="0 0 22 14" fill="#3a3e49"><path d="M2 0h3v14H2zM21 0v14L11 7zM12 0v14L2 7z"/></svg></span>
          <span class="lbl rr"><svg width="20" height="12" viewBox="0 0 22 14" fill="#3a3e49"><path d="M17 0h3v14h-3zM1 0v14l10-7zM10 0v14l10-7z"/></svg></span>
          <span class="lbl b"><svg width="24" height="12" viewBox="0 0 26 14" fill="#3a3e49"><path d="M0 0v14l10-7zM14 0h4v14h-4zM21 0h4v14h-4z"/></svg></span>
          <span class="dot" id="y2k-dot"></span>
          <button class="y2k-center" id="y2k-center" type="button" aria-label="Включить или выключить"><span class="led"></span></button>
        </div>
        <div class="y2k-orbs">
          <button type="button" class="y2k-orb" data-a="theme"><span class="ball">${ICON('<path d="M16 5a11 11 0 1 0 0 22c1.4 0 2-1 2-2 0-1.1-.7-1.6-.7-2.7 0-1.3 1-2.1 2.2-2.1h2.6A5 5 0 0 0 27 15.2C27 9.6 22 5 16 5z"/>')}</span>Тема</button>
          <button type="button" class="y2k-orb" data-a="settings"><span class="ball">${ICON('<path d="M6 10h20M6 16h20M6 22h20"/><circle cx="12" cy="10" r="2.4" fill="#fff"/><circle cx="20" cy="16" r="2.4" fill="#fff"/><circle cx="13" cy="22" r="2.4" fill="#fff"/>')}</span>Ещё</button>
        </div>
      </div>
    </section>
    <div class="y2k-scan"></div>
  </div>`;
  const $ = id => root.querySelector("#" + id);
  const el = $("y2k"), hero = $("y2k-hero");

  // ---------- состояние ----------
  let param = 0;                                 // что крутит колесо: яркость, тепло, оттенок
  let carousel = -1, carouselTimer = null;
  let note = "", noteTimer = null;                // короткое сообщение на экране после нажатия
  let live = null;                                // значение во время вращения (до отпускания пальца)
  let booting = true, bootPct = 0;
  const lit = () => App.S?.lamps && App.ids().some(i => App.S.lamps[i].on);
  const cur = () => App.shown() || {};
  const say = (text, ms = 2200) => {
    note = text; drawLcd();
    $("y2k-lcd").classList.remove("flash"); void $("y2k-lcd").offsetWidth; $("y2k-lcd").classList.add("flash");
    clearTimeout(noteTimer); noteTimer = setTimeout(() => { note = ""; drawLcd(); }, ms);
  };

  // ---------- крылья: перья на своих шарнирах, раскрываются веером с волной ----------
  const feathers = [];
  for (const side of ["l", "r"]) {
    const flap = $("y2k-w" + side).firstElementChild;
    ROWS.forEach((row, r) => {
      for (let i = 0; i < row.n; i++) {
        const t = i / (row.n - 1), img = document.createElement("img");
        img.src = SPRITE(row.sprite); img.alt = ""; img.className = "y2k-feather";
        img.style.transitionDelay = `${(r * 60 + i * 28)}ms`;
        flap.appendChild(img);
        feathers.push({img, side, row, r, t, len: row.len[0] + (row.len[1] - row.len[0]) * t});
      }
    });
  }
  let spread = 0;
  function layout() {
    const h = hero.clientHeight, bulbH = Math.min(h * .56, hero.clientWidth * .5), bulbW = bulbH / ASPECT.bulb;
    const b = $("y2k-bulb");
    b.style.width = bulbW + "px"; b.style.height = bulbH + "px";
    // плечи крыльев — на уровне верхней трети колбы, чуть внутрь от края
    const sx = bulbW * .3, sy = bulbH * .64;
    $("y2k-wl").style.transform = `translate(${-sx}px, ${-sy}px) translateZ(-10px) scaleX(-1)`;
    $("y2k-wr").style.transform = `translate(${sx}px, ${-sy}px) translateZ(-10px)`;
    for (const f of feathers) {
      const fh = h * f.row.h * f.len, fw = fh / ASPECT[f.row.sprite];
      Object.assign(f.img.style, {width: fw + "px", height: fh + "px", marginLeft: `${-fw / 2 + f.row.dx}px`, marginBottom: `${-f.row.dy}px`});
    }
    setSpread(spread, true);
  }
  function setSpread(s, force) {
    if (!force && Math.abs(s - spread) < .01) return;
    spread = s;
    for (const f of feathers) {
      const k = Math.min(1, Math.max(0, s * (1.12 - f.r * .06) - f.t * .05));
      const a = f.row.folded[0] + (f.row.folded[1] - f.row.folded[0]) * f.t, b = f.row.open[0] + (f.row.open[1] - f.row.open[0]) * f.t;
      f.img.style.transform = `rotate(${a + (b - a) * k}deg)`;
    }
  }
  const ro = new ResizeObserver(layout);
  ro.observe(hero);

  // ---------- загрузка: прогресс на экране, пока декодируются спрайты ----------
  const urls = [...new Set([...root.querySelectorAll("img")].map(i => i.src))];
  let done = 0;
  Promise.all(urls.map(u => { const i = new Image(); i.src = u; return i.decode().catch(() => {}).then(() => { done++; bootPct = done / urls.length; drawLcd(); }); }))
    .then(() => document.fonts?.ready).then(() => setTimeout(() => {
      booting = false; el.classList.remove("booting"); layout(); glitch(); say("READY ✦ WELCOME", 1600);
    }, 250));

  // ---------- отрисовка ----------
  function update() {
    const S = App.S;
    if (!S) return;
    const l = cur(), on = lit(), rgb = App.lampRgb(l) || [140, 160, 255];
    const sides = App.target === "both" ? S.lamps.map(x => App.lampRgb(x) || rgb) : [rgb, rgb];
    const bright = on ? (l.mode === "scene" ? 50 : (live != null && param === 0 ? live : l.bright) || 100) : 0;
    el.style.setProperty("--lamp", rgb.join(","));
    el.style.setProperty("--c1", sides[0].join(",")); el.style.setProperty("--c2", sides[1].join(","));
    el.style.setProperty("--lit", on ? (.3 + .7 * bright / 100).toFixed(2) : 0);
    if (el.classList.contains("lit") !== on) glitch();
    el.classList.toggle("lit", on);
    setSpread(on ? .4 + .6 * bright / 100 : 0);   // чем ярче свет, тем шире крылья
    drawPills(); drawLcd();
  }

  function drawPills() {
    const S = App.S, opts = [[0, "L1", S.names[0]], ["both", "✦ BOTH", "Обе"], [1, "L2", S.names[1]]];
    $("y2k-pills").innerHTML = opts.map(([k, t, n]) => `<button type="button" class="y2k-pill${App.target === k ? " on" : ""}" data-k="${k}" aria-label="${App.esc(n)}">${t}</button>`).join("");
    $("y2k-pills").querySelectorAll("button").forEach(b => b.onclick = () => {
      const k = b.dataset.k === "both" ? "both" : +b.dataset.k;
      App.setTarget(k);
      say(k === "both" ? "TARGET: L1 + L2" : `TARGET: ${App.S.names[k].toUpperCase()}`);
    });
  }

  function value(l) {
    if (live != null) return live;
    if (param === 0) return l.mode === "scene" ? 50 : l.bright ?? 100;
    if (param === 1) return l.mode === "temp" ? l.temp : 4000;
    return l.mode === "hsv" ? l.hsv.h : 0;
  }
  function drawLcd() {
    const lcd = $("y2k-lcd"), S = App.S;
    if (booting || !S) {
      const n = Math.round(bootPct * 14);
      lcd.innerHTML = `<div class="r"><span>SVETOKOT OS 2000</span>${catSvg(CAT_UP)}</div><div class="r"><span class="big">BOOT</span><span class="big">${Math.round(bootPct * 100)}%</span></div>
        <div class="bar">${Array.from({length: 14}, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>`;
      return;
    }
    if (S.lampsError) { lcd.innerHTML = `<div class="r">${catSvg(CAT_ZZ)}<span>ERROR</span></div><div class="dim" style="white-space:normal;margin-top:4px">${App.esc(S.lampsError)}</div>`; return; }
    const l = cur(), on = lit(), v = value(l), [, name] = PARAMS[param];
    const frac = param === 0 ? v / 100 : param === 1 ? (v - 1500) / 7500 : v / 360;
    const shown = param === 0 ? `${Math.round(v)}%` : param === 1 ? `${Math.round(v)}K` : `${Math.round(v)}°`;
    const who = App.target === "both" ? "L1+L2" : App.target === 0 ? "L1" : "L2";
    const paused = S.circ.enabled && App.ids().some(i => S.lamps[i].paused);
    const status = note || (!on ? "ZZZ… PRESS CENTER" : l.mode === "scene" ? `SCENE ${l.scene === "candle" ? "CANDLE" : YANDEX[l.scene] || l.scene.toUpperCase()}`
      : paused ? "CIRCADIAN PAUSED" : S.circ.enabled ? `CIRCADIAN ${S.circ.k}K` : l.mode === "hsv" ? "COLOR MODE" : "WHITE MODE");
    lcd.innerHTML = `
      <div class="r"><span>${who} ${on ? "● ON" : "○ OFF"}</span><span class="dim">${PARAMS.map((p, i) => i === param ? `[${p[1][0]}]` : p[1][0]).join(" ")}</span>${catSvg(on ? CAT_UP : CAT_ZZ)}</div>
      <div class="r"><span class="big">${name}</span><span class="big">${on ? shown : "--"}</span></div>
      <div class="bar">${Array.from({length: 14}, (_, i) => `<i class="${on && i < Math.round(frac * 14) ? "on" : ""}"></i>`).join("")}</div>
      <div class="r dim"><span>${App.esc(status)}</span></div>`;
    const r = $("y2k-wheel").clientWidth / 2 * .62, a = (frac * 330 - 165 - 90) * Math.PI / 180;
    $("y2k-dot").style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`;
  }

  // ---------- действия ----------
  function toggle() {
    if (!App.S?.lamps) return;
    App.haptic.tap();
    const on = lit();
    App.cmd(on ? "off" : "on");
    say(on ? "POWER OFF" : "POWER ON ✦");
  }
  function glitch() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("glitching");
    setTimeout(() => el.classList.remove("glitching"), 320);
  }
  function nextParam() {
    param = (param + 1) % PARAMS.length;
    App.haptic.pick(); App.sound.pick();
    say(`WHEEL → ${PARAMS[param][1]} ↻`);
  }
  // ⏮/⏭ листают карусель: фирменные сцены темы, ночник, сцены Яндекса и свои пресеты. Применяется, когда листать перестали.
  function items() {
    const S = App.S;
    return [...SIGNATURE,
      {name: "CANDLE", list: [{lamps: [0, 1], kind: "night", value: null}]},
      ...Object.keys(YANDEX).filter(k => S.scenes.includes(k)).map(k => ({name: YANDEX[k], list: [{lamps: [0, 1], kind: "scene", value: k}]})),
      ...(S.presets || []).map(p => ({name: p.name.toUpperCase().slice(0, 14), list: [{lamps: [0, 1], kind: p.cmd.kind, value: p.cmd.value}]}))];
  }
  function flip(dir) {
    const all = items();
    carousel = (carousel + dir + all.length) % all.length;
    App.haptic.pick(); App.sound.tick();
    say(`${dir > 0 ? "⏭" : "⏮"} ${all[carousel].name}  ${carousel + 1}/${all.length}`, 3000);
    clearTimeout(carouselTimer);
    carouselTimer = setTimeout(() => applyItem(all[carousel]), 600);
  }
  function applyItem(it) {
    let list = it.list;
    if (App.target !== "both") {   // сцена на одну лампу: берём цвет, заданный для этой лампы
      const t = App.target, x = list.find(e => e.lamps.includes(t)) || list[0];
      list = [{...x, lamps: [t]}];
    }
    App.scene(list.map(x => ({...x, patch: patchOf(x.kind, x.value)})));
    App.sound.glitch(); glitch();
    say(`✦ ${it.name}`, 3000);
  }
  function night() {
    App.haptic.tap();
    App.cmd("night", null, {mode: "scene", scene: "candle"});
    glitch(); say("▶ CANDLE · НОЧНИК");
  }

  // ---------- колесо: вращение меняет значение, нажатия по сторонам — кнопки ----------
  const wheel = $("y2k-wheel");
  let drag = null, rot = 0;
  const angleAt = e => { const b = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - b.top - b.height / 2, e.clientX - b.left - b.width / 2) * 180 / Math.PI; };
  wheel.addEventListener("pointerdown", e => {
    if (e.target.closest(".y2k-center") || !App.S?.lamps) return;
    wheel.setPointerCapture(e.pointerId);
    drag = {last: angleAt(e), acc: 0, total: 0, start: value(cur()), x: e.clientX, y: e.clientY};
    App.dragging = true;
  });
  wheel.addEventListener("pointermove", e => {
    if (!drag) return;
    const a = angleAt(e);
    let d = a - drag.last;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    drag.last = a; drag.acc += d; drag.total += Math.abs(d);
    rot += d; $("y2k-ring").style.setProperty("--rot", rot + "deg");   // кольцо крутится под пальцем
    while (Math.abs(drag.acc) >= STEP_DEG) {
      const s = Math.sign(drag.acc); drag.acc -= s * STEP_DEG;
      const v = live ?? drag.start;
      live = param === 0 ? Math.min(100, Math.max(1, v + s * 3)) : param === 1 ? Math.min(9000, Math.max(1500, v + s * 150)) : (v + s * 8 + 360) % 360;
      App.sound.tick(); App.haptic.pick();
      if (lit()) App.preview(param === 0 ? {bright: live} : param === 1 ? {mode: "temp", temp: live} : {mode: "hsv", hsv: {h: live, s: 100, v: 100}});
      else { note = "LIGHT IS OFF — PRESS CENTER"; }
    }
    drawLcd();
  });
  wheel.addEventListener("pointerup", e => {
    if (!drag) return;
    const tap = drag.total < 10 && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 12;
    drag = null; App.dragging = false;
    if (tap) { live = null; return press(e); }
    if (live == null) return;
    const v = live, b = cur().bright || 100;
    live = null;
    if (!lit()) return say("LIGHT IS OFF — PRESS CENTER");
    if (param === 0) App.cmd("bright", v, {bright: v});
    else if (param === 1) App.cmd("temp", {k: v, b}, {mode: "temp", temp: v, bright: b});
    else App.cmd("hsv", {h: v, s: 100, b}, {mode: "hsv", hsv: {h: v, s: 100, v: 100}, bright: b});
  });
  wheel.addEventListener("pointercancel", () => { drag = null; live = null; App.dragging = false; update(); });
  function press(e) {
    const b = wheel.getBoundingClientRect(), dx = e.clientX - b.left - b.width / 2, dy = e.clientY - b.top - b.height / 2;
    const q = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? "t" : "b") : (dx < 0 ? "l" : "r");
    // вспышка нажатой четверти — видно, что кнопка сработала
    const fl = $("y2k-fl"), at = {t: "50% 12%", b: "50% 88%", l: "12% 50%", r: "88% 50%"}[q];
    fl.style.background = `radial-gradient(circle at ${at}, rgba(120,170,255,.9), transparent 38%)`;
    fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
    ({t: nextParam, b: night, l: () => flip(-1), r: () => flip(1)})[q]();
  }
  $("y2k-center").onclick = toggle;
  $("y2k-lcd").onclick = nextParam;
  root.querySelectorAll(".y2k-orb").forEach(b => b.onclick = () => {
    App.haptic.pick();
    ({modes: App.openModes, scenes: App.openScenes, theme: App.openThemes, settings: App.openSettings})[b.dataset.a]();
  });

  // ---------- сцена: тап по лампочке — вкл/выкл, свайп — поворот с инерцией (CSS 3D-параллакс) ----------
  let yaw = 0, pitch = 0, vel = 0, down = null, spin = 0;
  const rig = $("y2k-rig");
  const apply = () => { rig.style.setProperty("--yaw", yaw + "deg"); rig.style.setProperty("--pitch", pitch + "deg"); };
  hero.addEventListener("pointerdown", e => {
    if (e.target.closest(".y2k-pills")) return;
    hero.setPointerCapture(e.pointerId);
    down = {x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now()};
    cancelAnimationFrame(spin);
  });
  hero.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - down.lx; down.lx = e.clientX;
    yaw = Math.max(-35, Math.min(35, yaw + dx * .25)); vel = dx * .25;
    pitch = Math.max(-10, Math.min(10, (e.clientY - down.y) * -.05));
    apply();
  });
  hero.addEventListener("pointerup", e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 400;
    down = null;
    if (moved < 10 && quick) {
      const r = $("y2k-bulb").getBoundingClientRect();
      if (e.clientX > r.left - 20 && e.clientX < r.right + 20 && e.clientY > r.top - 20 && e.clientY < r.bottom + 10) {
        $("y2k-bulb").classList.add("press"); setTimeout(() => $("y2k-bulb").classList.remove("press"), 150);
        toggle();
      }
    }
    // инерция, затем мягкий возврат к центру
    const settle = () => {
      yaw += vel; vel *= .9; yaw *= .94; pitch *= .9; apply();
      if (Math.abs(vel) > .05 || Math.abs(yaw) > .3 || Math.abs(pitch) > .2) spin = requestAnimationFrame(settle);
    };
    spin = requestAnimationFrame(settle);
  });
  hero.addEventListener("pointercancel", () => { down = null; });

  // подсказка для первого раза
  App.store.get("y2kHint2").then(seen => {
    if (seen === "1") return;
    $("y2k-hint").textContent = "тап по лампе · крути колесо";
    setTimeout(() => { $("y2k-hint").textContent = ""; App.store.set("y2kHint2", "1"); }, 8000);
  });

  drawLcd();
  return {
    update,
    unmount() { ro.disconnect(); cancelAnimationFrame(spin); clearTimeout(noteTimer); clearTimeout(carouselTimer); style.remove(); root.innerHTML = ""; },
  };
}
