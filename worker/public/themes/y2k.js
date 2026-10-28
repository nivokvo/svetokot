// Y2K-тема Светокота: своя раскладка поверх общего ядра Mini App (window.App в app.html).
// Сверху — WebGL-сцена: лампочка из жидкого хрома с крыльями из перьев, хромовые звёзды, искры, свечение и глитч.
// Снизу — ЖК-экран и колесо как у iPod: крутишь — меняется яркость, тепло или оттенок, кнопки колеса — сцены и ночник.

import * as THREE from "three";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer.js";
import {RenderPass} from "three/addons/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/addons/postprocessing/UnrealBloomPass.js";
import {ShaderPass} from "three/addons/postprocessing/ShaderPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";

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

const patchOf = (kind, v) => kind === "hsv" ? {mode: "hsv", hsv: {h: v.h, s: v.s, v: 100}, bright: v.b || 100}
  : kind === "temp" ? {mode: "temp", temp: v.k, bright: v.b || 100} : {mode: "scene", scene: kind === "night" ? "candle" : v};

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800;900&family=VT323&display=swap");
html[data-theme="y2k"] { --bg: #05050b; --text: #eef2ff; --hint: #8f97c2; --accent: #4a63ff; --accent-text: #fff; --danger: #ff5c8a;
  --card: rgba(160,180,255,.07); --card2: rgba(160,180,255,.13); --line: rgba(160,180,255,.18); }
html[data-theme="y2k"] body { padding: 0; background: #030308; overflow-x: hidden; }
.y2k { --glh: min(340px, 88vw); --wh: min(196px, 52vw); position: relative; min-height: 100vh; color: #eef2ff; font-family: -apple-system, system-ui, sans-serif; overflow: hidden;
  padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
.y2k * { box-sizing: border-box; }
.y2k-bg { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 60% at 50% 22%, rgba(var(--lamp), calc(.06 + .3 * var(--lit))) 0%, transparent 60%),
              radial-gradient(80% 50% at 50% 110%, rgba(74,99,255,.22), transparent 70%), #030308; transition: background .6s; }
.y2k-scan { position: absolute; inset: 0; pointer-events: none; z-index: 6; opacity: .14;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 3px); mix-blend-mode: overlay; }
.y2k-halftone { position: absolute; left: 0; right: 0; bottom: 0; height: 45%; pointer-events: none; opacity: .18;
  background: radial-gradient(circle, rgba(140,160,255,.9) 1px, transparent 1.6px) 0 0 / 7px 7px;
  -webkit-mask: linear-gradient(transparent, #000); mask: linear-gradient(transparent, #000); }

/* небесная арка: облака в хромовой раме, светятся цветом ламп */
.y2k-arch { position: absolute; left: 50%; top: 84px; width: min(200px, 54vw); height: calc(var(--glh) - 70px); transform: translateX(-50%);
  border-radius: 999px 999px 18px 18px; overflow: hidden; pointer-events: none; opacity: calc(.12 + .7 * var(--lit)); transition: opacity .8s;
  box-shadow: 0 0 0 3px #c9cfdc, 0 0 0 5px #5d6372, 0 0 0 7px #eef1f7, 0 0 60px rgba(var(--lamp), calc(.5 * var(--lit))); }
.y2k-arch svg { position: absolute; inset: -20%; width: 140%; height: 140%; animation: drift 38s linear infinite alternate; }
.y2k-arch::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(var(--lamp), .55), rgba(10,14,40,.2) 70%); mix-blend-mode: color; }
@keyframes drift { to { transform: translate(-12%, 4%); } }

.y2k-gl { position: absolute; left: 0; right: 0; top: 28px; height: var(--glh); z-index: 2; touch-action: pan-y;
  -webkit-mask: linear-gradient(#000 82%, transparent); mask: linear-gradient(#000 82%, transparent); }
.y2k-gl canvas { width: 100% !important; height: 100% !important; display: block; }
.y2k-nogl { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); font: 18px VT323, monospace; color: #8f97c2; text-align: center; }

.y2k-top { position: relative; z-index: 5; height: 64px; padding: 14px 16px 0; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
.y2k-meta { font: 15px/1 VT323, monospace; letter-spacing: 1px; color: #9fb2ff; text-transform: uppercase; }
.y2k-meta b { color: #ff7a2f; font-weight: 400; }
.y2k-title { position: relative; font: 900 30px/0.95 Unbounded, sans-serif; letter-spacing: -1px; margin: 4px 0 0;
  background: linear-gradient(180deg, #fff 0%, #dfe5f2 38%, #6f7686 50%, #f4f6fb 62%, #a8afbd 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 10px rgba(120,150,255,.35)); }
.y2k-title::before, .y2k-title::after { content: attr(data-text); position: absolute; inset: 0; background: inherit; -webkit-background-clip: text; background-clip: text; opacity: 0; }
.y2k.glitching .y2k-title::before { opacity: .9; color: rgba(0,240,255,.8); -webkit-text-fill-color: rgba(0,240,255,.8); transform: translate(-3px, 0); clip-path: inset(10% 0 55% 0); }
.y2k.glitching .y2k-title::after { opacity: .9; color: rgba(255,40,180,.8); -webkit-text-fill-color: rgba(255,40,180,.8); transform: translate(3px, 1px); clip-path: inset(55% 0 8% 0); }
.y2k-barcode { width: 64px; height: 26px; margin-top: 4px;
  background: repeating-linear-gradient(90deg, #dfe5ff 0 2px, transparent 2px 3px, #dfe5ff 3px 4px, transparent 4px 7px, #dfe5ff 7px 10px, transparent 10px 11px); opacity: .8; }
.y2k-vert { position: absolute; right: 8px; top: 96px; z-index: 5; writing-mode: vertical-rl; font: 15px/1.1 "Hiragino Sans", "Noto Sans JP", sans-serif;
  letter-spacing: 6px; color: rgba(210,222,255,.55); pointer-events: none; text-shadow: 0 0 8px rgba(120,150,255,.6); }
.y2k-hint { position: absolute; left: 50%; top: calc(28px + var(--glh) - 66px); transform: translateX(-50%); z-index: 5; pointer-events: none;
  font: 15px VT323, monospace; letter-spacing: 2px; color: rgba(220,230,255,.65); text-transform: uppercase; white-space: nowrap; }

.y2k-pills { position: absolute; left: 0; right: 0; top: calc(28px + var(--glh) - 36px); z-index: 5; display: flex; justify-content: center; gap: 8px; }
.y2k-pill { border: 0; border-radius: 999px; padding: 8px 14px; font: 800 12px Unbounded, sans-serif; letter-spacing: .5px; color: #20232c; cursor: pointer;
  background: linear-gradient(180deg, #ffffff 0%, #d9dde7 42%, #858b99 50%, #e6e9f0 100%);
  box-shadow: inset 0 1px 0 #fff, inset 0 -2px 3px rgba(0,0,0,.25), 0 4px 14px rgba(0,0,0,.5); transition: transform .15s, box-shadow .25s; }
.y2k-pill:active { transform: scale(.94); }
.y2k-pill.on { color: #fff; background: linear-gradient(180deg, #8ea0ff 0%, #4a63ff 45%, #1f2fd1 52%, #5b72ff 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 0 18px rgba(74,99,255,.9), 0 4px 14px rgba(0,0,0,.5); }

.y2k-console { position: relative; z-index: 5; margin-top: calc(var(--glh) - 20px); padding: 0 16px; display: grid; justify-items: center; gap: 14px; }
.y2k-lcd { width: 100%; max-width: 360px; border-radius: 16px; padding: 9px 13px 8px; position: relative; overflow: hidden; cursor: pointer;
  background: linear-gradient(180deg, #0e1f5c, #07103a); color: #a9d6ff; font: 20px/1.05 VT323, monospace; letter-spacing: 1px;
  box-shadow: inset 0 0 0 2px rgba(169,214,255,.25), inset 0 0 30px rgba(0,0,0,.6), 0 0 0 3px #c9cfdc, 0 0 0 5px #4d5262, 0 10px 30px rgba(0,0,0,.6);
  text-shadow: 0 0 6px rgba(120,190,255,.8); }
.y2k-lcd::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 1px, transparent 1px 3px); }
.y2k-lcd .r { display: flex; justify-content: space-between; align-items: center; gap: 8px; white-space: nowrap; }
.y2k-lcd .big { font-size: 32px; line-height: 1; margin: 4px 0 2px; }
.y2k-lcd .bar { display: flex; gap: 3px; margin: 6px 0; }
.y2k-lcd .bar i { flex: 1; height: 10px; background: rgba(169,214,255,.18); }
.y2k-lcd .bar i.on { background: #a9d6ff; box-shadow: 0 0 6px #6fb8ff; }
.y2k-lcd .dim { opacity: .6; font-size: 17px; }
.y2k-cat { width: 36px; height: 30px; image-rendering: pixelated; }

.y2k-wheel { position: relative; width: var(--wh); aspect-ratio: 1; border-radius: 50%; touch-action: none; user-select: none; -webkit-user-select: none;
  background: conic-gradient(from 10deg, #f6f7fb, #9aa0ad 12%, #ffffff 24%, #7b818e 37%, #eef0f5 50%, #8d93a0 62%, #ffffff 75%, #858b98 88%, #f6f7fb);
  box-shadow: inset 0 2px 2px #fff, inset 0 -6px 14px rgba(0,0,0,.35), 0 18px 40px rgba(0,0,0,.7), 0 0 0 1px #3d414c, 0 0 50px rgba(var(--lamp), calc(.45 * var(--lit))); }
.y2k-wheel .lbl { position: absolute; font: 800 12px Unbounded, sans-serif; color: #3a3e49; letter-spacing: 1px; pointer-events: none; text-shadow: 0 1px 0 rgba(255,255,255,.7); }
.y2k-wheel .lbl svg { display: block; }
.y2k-wheel .t { left: 50%; top: 9%; transform: translateX(-50%); }
.y2k-wheel .b { left: 50%; bottom: 9%; transform: translateX(-50%); }
.y2k-wheel .l { left: 9%; top: 50%; transform: translateY(-50%); }
.y2k-wheel .rr { right: 9%; top: 50%; transform: translateY(-50%); }
.y2k-wheel .dot { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px; border-radius: 50%; pointer-events: none;
  background: rgb(var(--lamp)); box-shadow: 0 0 10px rgb(var(--lamp)); opacity: calc(.25 + .75 * var(--lit)); }
.y2k-center { position: absolute; left: 50%; top: 50%; width: 38%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; border: 0; cursor: pointer;
  background: radial-gradient(circle at 35% 28%, #ffffff 0%, #e3e6ee 30%, #8b919e 70%, #c9ccd6 100%);
  box-shadow: inset 0 -4px 8px rgba(0,0,0,.35), 0 4px 10px rgba(0,0,0,.45), 0 0 0 4px rgba(0,0,0,.15); display: grid; place-items: center; transition: transform .12s; }
.y2k-center:active { transform: translate(-50%, -50%) scale(.94); }
.y2k-center .led { width: 30%; aspect-ratio: 1; border-radius: 50%; background: #2a2d36; box-shadow: inset 0 1px 3px rgba(0,0,0,.6); transition: background .4s, box-shadow .4s; }
.y2k.lit .y2k-center .led { background: rgb(var(--lamp)); box-shadow: 0 0 14px rgb(var(--lamp)), 0 0 30px rgba(var(--lamp), .7), inset 0 1px 2px rgba(255,255,255,.7); }

.y2k-dock { position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 8; display: flex; justify-content: space-around;
  padding: 8px 6px; border-radius: 24px; background: rgba(14,16,30,.62); backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
  box-shadow: inset 0 0 0 1px rgba(200,210,255,.18), 0 10px 30px rgba(0,0,0,.6); }
.y2k-dock button { border: 0; background: none; color: #dfe5ff; display: grid; justify-items: center; gap: 3px; cursor: pointer; padding: 4px 6px;
  font: 500 10px Unbounded, sans-serif; letter-spacing: .3px; transition: transform .15s; }
.y2k-dock button:active { transform: scale(.9); }
.y2k-dock svg { width: 30px; height: 30px; filter: drop-shadow(0 0 6px rgba(140,170,255,.55)); }

/* окна в стиле 2000-х: шторка ядра получает хромовую шапку */
html[data-theme="y2k"] .sheet { background: rgba(2,3,10,.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
html[data-theme="y2k"] .sheet-card { background: rgba(10,12,26,.94); border-radius: 18px 18px 0 0; padding-top: 0;
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
@media (prefers-reduced-motion: reduce) { .y2k-arch svg { animation: none; } }
`;

const CAT_UP = ["..X......X..", ".XX......XX.", ".XXXXXXXXXX.", "XXXXXXXXXXXX", "XX..XXXX..XX", "XXXXXXXXXXXX", "XXXXX..XXXXX", ".XXXXXXXXXX.", "..XX....XX.."];
const CAT_ZZ = ["............", "..X......X..", ".XXXXXXXXXX.", "XXXXXXXXXXXX", "XX--XXXX--XX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", ".XXXXXXXXXXX", "..XXXXXXXXX."];
const catSvg = rows => `<svg class="y2k-cat" viewBox="0 0 12 9" fill="#a9d6ff">${rows.flatMap((r, y) => [...r].map((c, x) => c === "X" ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : "")).join("")}</svg>`;

const ICON = (paths) => `<svg viewBox="0 0 32 32" fill="none" stroke="url(#chrome)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export function mount(App, root) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  root.innerHTML = `
  <div class="y2k" id="y2k">
    <svg width="0" height="0" style="position:absolute"><defs>
      <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#c3c9d8"/><stop offset=".5" stop-color="#6c7383"/><stop offset=".62" stop-color="#eef1f7"/><stop offset="1" stop-color="#9aa1b1"/></linearGradient>
      <filter id="clouds" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="5" seed="7"/>
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -.55"/></filter>
    </defs></svg>
    <div class="y2k-bg"></div>
    <div class="y2k-arch"><svg viewBox="0 0 400 520" preserveAspectRatio="none"><rect width="400" height="520" fill="#1d2f7a"/><rect width="400" height="520" filter="url(#clouds)"/></svg></div>
    <div class="y2k-halftone"></div>
    <header class="y2k-top">
      <div><div class="y2k-meta">new millennium <b>✦</b> new light</div><h1 class="y2k-title" data-text="СВЕТОКОТ">СВЕТОКОТ</h1></div>
      <div style="text-align:right"><div class="y2k-meta">vol. 2000</div><div class="y2k-barcode"></div></div>
    </header>
    <div class="y2k-vert">光の猫 ✦ 二〇〇〇 ✦ 寝室</div>
    <div class="y2k-gl" id="y2k-gl"></div>
    <div class="y2k-hint" id="y2k-hint"></div>
    <div class="y2k-pills" id="y2k-pills"></div>
    <section class="y2k-console">
      <div class="y2k-lcd" id="y2k-lcd" role="button" aria-label="Сменить параметр колеса"></div>
      <div class="y2k-wheel" id="y2k-wheel" aria-label="Колесо">
        <span class="lbl t">MENU</span>
        <span class="lbl l"><svg width="22" height="14" viewBox="0 0 22 14" fill="#3a3e49"><path d="M2 0h3v14H2zM21 0v14L11 7zM12 0v14L2 7z"/></svg></span>
        <span class="lbl rr"><svg width="22" height="14" viewBox="0 0 22 14" fill="#3a3e49"><path d="M17 0h3v14h-3zM1 0v14l10-7zM10 0v14l10-7z"/></svg></span>
        <span class="lbl b"><svg width="26" height="14" viewBox="0 0 26 14" fill="#3a3e49"><path d="M0 0v14l10-7zM14 0h4v14h-4zM21 0h4v14h-4z"/></svg></span>
        <span class="dot" id="y2k-dot"></span>
        <button class="y2k-center" id="y2k-center" type="button" aria-label="Включить или выключить"><span class="led"></span></button>
      </div>
    </section>
    <nav class="y2k-dock">
      <button type="button" data-a="modes">${ICON('<circle cx="16" cy="16" r="6"/><path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M6.8 25.2l2.1-2.1M23.1 8.9l2.1-2.1"/>')}Режимы</button>
      <button type="button" data-a="scenes">${ICON('<path d="M16 3l3.2 9.8L29 16l-9.8 3.2L16 29l-3.2-9.8L3 16l9.8-3.2z"/>')}Сцены</button>
      <button type="button" data-a="theme">${ICON('<path d="M16 4a12 12 0 1 0 0 24c1.5 0 2.2-1 2.2-2.1 0-1.2-.8-1.7-.8-2.9 0-1.4 1.1-2.3 2.4-2.3h2.8A5.4 5.4 0 0 0 28 15.3C28 9 22.6 4 16 4z"/><circle cx="10" cy="15" r="1.4"/><circle cx="13.5" cy="9.5" r="1.4"/><circle cx="20" cy="10" r="1.4"/>')}Тема</button>
      <button type="button" data-a="settings">${ICON('<path d="M5 9h22M5 16h22M5 23h22"/><circle cx="11" cy="9" r="2.6"/><circle cx="21" cy="16" r="2.6"/><circle cx="13" cy="23" r="2.6"/>')}Ещё</button>
    </nav>
    <div class="y2k-scan"></div>
  </div>`;
  const $ = id => root.querySelector("#" + id);
  const el = $("y2k");

  // ---------- состояние колеса и карусели сцен ----------
  let param = 0;            // что крутит колесо: яркость, тепло, оттенок
  let carousel = -1, carouselName = "", carouselTimer = null, sceneLabel = "";
  let live = null;           // значение во время вращения (до отпускания пальца)
  const lit = () => App.S?.lamps && App.ids().some(i => App.S.lamps[i].on);
  const cur = () => App.shown() || {};

  // ---------- WebGL-сцена ----------
  const gl = createScene($("y2k-gl"), {onTap: () => toggle(), App});

  function update() {
    const S = App.S;
    if (!S) return;
    const l = cur(), on = lit(), rgb = App.lampRgb(l) || [140, 160, 255];
    el.style.setProperty("--lamp", rgb.join(","));
    el.style.setProperty("--lit", on ? (l.mode === "scene" ? .55 : .3 + .7 * (l.bright || 100) / 100).toFixed(2) : 0);
    el.classList.toggle("lit", on);
    // в режиме «Обе» левое крыло — цвет «Лампы 1», правое — «Лампы 2»: видно дуо-сцены
    const sides = App.target === "both" ? S.lamps.map(x => App.lampRgb(x) || rgb) : [rgb, rgb];
    gl?.setState({on, rgb, sides, bright: on ? (l.mode === "scene" ? 50 : l.bright || 100) : 0});
    drawPills(); drawLcd();
  }

  function drawPills() {
    const S = App.S, opts = [[0, "L1", S.names[0]], ["both", "✦ BOTH", "Обе"], [1, "L2", S.names[1]]];
    $("y2k-pills").innerHTML = opts.map(([k, t, n]) => `<button type="button" class="y2k-pill${App.target === k ? " on" : ""}" data-k="${k}" aria-label="${App.esc(n)}">${t}</button>`).join("");
    $("y2k-pills").querySelectorAll("button").forEach(b => b.onclick = () => App.setTarget(b.dataset.k === "both" ? "both" : +b.dataset.k));
  }

  function value(l) {
    if (live != null) return live;
    if (param === 0) return l.mode === "scene" ? 50 : l.bright ?? 100;
    if (param === 1) return l.mode === "temp" ? l.temp : 4000;
    return l.mode === "hsv" ? l.hsv.h : 0;
  }
  function drawLcd() {
    const S = App.S, l = cur(), on = lit();
    if (S.lampsError) { $("y2k-lcd").innerHTML = `<div class="r">${catSvg(CAT_ZZ)}<span>ERROR</span></div><div class="dim" style="white-space:normal;margin-top:6px">${App.esc(S.lampsError)}</div>`; return; }
    const v = value(l), [, name] = PARAMS[param];
    const frac = param === 0 ? v / 100 : param === 1 ? (v - 1500) / 7500 : v / 360;
    const shown = param === 0 ? `${Math.round(v)}%` : param === 1 ? `${Math.round(v)}K` : `${Math.round(v)}°`;
    const who = App.target === "both" ? "L1+L2" : App.target === 0 ? "L1" : "L2";
    const paused = S.circ.enabled && App.ids().some(i => S.lamps[i].paused);
    const status = carouselName ? `▶ ${carouselName}` : sceneLabel ? `✦ ${sceneLabel}`
      : !on ? "ZZZ… TAP CENTER" : l.mode === "scene" ? `SCENE ${(l.scene === "candle" ? "NIGHT" : YANDEX[l.scene] || l.scene).toUpperCase()}`
      : paused ? "CIRCADIAN PAUSED" : S.circ.enabled ? `CIRCADIAN ${S.circ.k}K` : l.mode === "hsv" ? "COLOR MODE" : "WHITE MODE";
    $("y2k-lcd").innerHTML = `
      <div class="r"><span>${who} ${on ? "● ON" : "○ OFF"}</span>${catSvg(on ? CAT_UP : CAT_ZZ)}</div>
      <div class="r"><span class="big">${name}</span><span class="big">${on ? shown : "--"}</span></div>
      <div class="bar">${Array.from({length: 14}, (_, i) => `<i class="${on && i < Math.round(frac * 14) ? "on" : ""}"></i>`).join("")}</div>
      <div class="r dim"><span>${status}</span><span>${PARAMS.map((p, i) => i === param ? `[${p[1][0]}]` : p[1][0]).join(" ")}</span></div>`;
    const dot = $("y2k-dot"), r = $("y2k-wheel").clientWidth / 2 * .6, a = (frac * 330 - 165 - 90) * Math.PI / 180;
    dot.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`;
  }

  // ---------- действия ----------
  function toggle() {
    if (!App.S?.lamps) return;
    App.haptic.tap();
    App.cmd(lit() ? "off" : "on");
    glitch();
  }
  function glitch() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("glitching"); gl?.glitch();
    setTimeout(() => el.classList.remove("glitching"), 320);
  }
  function nextParam() {
    param = (param + 1) % PARAMS.length;
    App.haptic.pick(); App.sound.pick();
    drawLcd();
  }
  // ⏮/⏭ листают карусель: фирменные сцены темы, ночник, сцены Яндекса и свои пресеты. Применяется, когда листать перестали.
  function items() {
    const S = App.S;
    return [...SIGNATURE.map(x => ({name: x.name, list: x.list})),
      {name: "NIGHT", list: [{lamps: [0, 1], kind: "night", value: null}]},
      ...Object.keys(YANDEX).filter(k => S.scenes.includes(k)).map(k => ({name: YANDEX[k], list: [{lamps: [0, 1], kind: "scene", value: k}]})),
      ...(S.presets || []).map(p => ({name: p.name.toUpperCase().slice(0, 14), list: [{lamps: [0, 1], kind: p.cmd.kind, value: p.cmd.value}]}))];
  }
  function flip(dir) {
    const all = items();
    carousel = (carousel + dir + all.length) % all.length;
    carouselName = all[carousel].name;
    App.haptic.pick(); App.sound.tick();
    drawLcd();
    clearTimeout(carouselTimer);
    carouselTimer = setTimeout(() => applyItem(all[carousel]), 550);
  }
  function applyItem(it) {
    carouselName = ""; sceneLabel = it.name;
    setTimeout(() => { sceneLabel = ""; drawLcd(); }, 4000);
    // сцена на одну лампу: берём цвет, заданный для этой лампы
    let list = it.list;
    if (App.target !== "both") {
      const t = App.target, x = list.find(e => e.lamps.includes(t)) || list[0];
      list = [{...x, lamps: [t]}];
    }
    App.scene(list.map(x => ({...x, patch: patchOf(x.kind, x.value)})));
    App.sound.glitch(); glitch();
  }
  function night() {
    App.haptic.tap();
    App.cmd("night", null, {mode: "scene", scene: "candle"});
    glitch();
  }

  // ---------- колесо: вращение меняет значение, нажатия по сторонам — кнопки ----------
  const wheel = $("y2k-wheel");
  let drag = null;
  const angleAt = e => { const b = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - b.top - b.height / 2, e.clientX - b.left - b.width / 2) * 180 / Math.PI; };
  wheel.addEventListener("pointerdown", e => {
    if (e.target.closest(".y2k-center") || !App.S?.lamps) return;
    wheel.setPointerCapture(e.pointerId);
    const l = cur();
    drag = {last: angleAt(e), acc: 0, total: 0, start: value(l), x: e.clientX, y: e.clientY};
    App.dragging = true;
  });
  wheel.addEventListener("pointermove", e => {
    if (!drag) return;
    let a = angleAt(e), d = a - drag.last;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    drag.last = a; drag.acc += d; drag.total += Math.abs(d);
    while (Math.abs(drag.acc) >= STEP_DEG) {
      const s = Math.sign(drag.acc); drag.acc -= s * STEP_DEG;
      const v = live ?? drag.start;
      live = param === 0 ? Math.min(100, Math.max(1, v + s * 3)) : param === 1 ? Math.min(9000, Math.max(1500, v + s * 150)) : (v + s * 8 + 360) % 360;
      App.sound.tick(); App.haptic.pick();
      if (!lit()) continue;
      App.preview(param === 0 ? {bright: live} : param === 1 ? {mode: "temp", temp: live} : {mode: "hsv", hsv: {h: live, s: 100, v: 100}});
    }
    drawLcd();
  });
  const up = e => {
    if (!drag) return;
    const tap = drag.total < 10 && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 12;
    drag = null; App.dragging = false;
    if (tap) { live = null; return press(e); }
    if (live == null) return;
    const v = live, b = cur().bright || 100;
    live = null;
    if (!lit()) return drawLcd();
    if (param === 0) App.cmd("bright", v, {bright: v});
    else if (param === 1) App.cmd("temp", {k: v, b}, {mode: "temp", temp: v, bright: b});
    else App.cmd("hsv", {h: v, s: 100, b}, {mode: "hsv", hsv: {h: v, s: 100, v: 100}, bright: b});
  };
  wheel.addEventListener("pointerup", up);
  wheel.addEventListener("pointercancel", () => { drag = null; live = null; App.dragging = false; update(); });
  function press(e) {
    const b = wheel.getBoundingClientRect(), dx = e.clientX - b.left - b.width / 2, dy = e.clientY - b.top - b.height / 2;
    if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? nextParam() : night();
    flip(dx < 0 ? -1 : 1);
  }
  $("y2k-center").onclick = toggle;
  $("y2k-lcd").onclick = nextParam;
  root.querySelectorAll(".y2k-dock button").forEach(b => b.onclick = () => {
    App.haptic.pick();
    ({modes: App.openModes, scenes: App.openScenes, theme: App.openThemes, settings: App.openSettings})[b.dataset.a]();
  });

  // подсказка для первого раза: как пользоваться колесом
  App.store.get("y2kHint").then(seen => {
    if (seen === "1") return;
    $("y2k-hint").textContent = "↻ крути колесо · тап по лампе";
    setTimeout(() => { $("y2k-hint").textContent = ""; App.store.set("y2kHint", "1"); }, 9000);
  });

  window.addEventListener("resize", drawLcdSafe);
  function drawLcdSafe() { if (App.S) drawLcd(); }

  return {
    update,
    unmount() { gl?.dispose(); style.remove(); window.removeEventListener("resize", drawLcdSafe); root.innerHTML = ""; },
  };
}

// ---------- three.js: хромовая лампочка с крыльями ----------
function createScene(box, {onTap}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: "high-performance"});
  } catch {
    box.innerHTML = `<div class="y2k-nogl">3D недоступно на этом устройстве<br>колесо и экран работают</div>`;
    return null;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  renderer.setClearColor(0x000000, 0);
  box.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, .3, 13);

  // Окружение для хрома: чёрная студия с яркими полосами света — отсюда резкие белые блики, как у хромовых иконок.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020207);
  const strip = (w, h, x, y, z, color, power) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide}));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  strip(14, 1.4, 0, 7, -1, 0xffffff, 7); strip(1.2, 10, -8, 0, 2, 0xffffff, 5); strip(1, 10, 8, 1, -2, 0xdfe6ff, 5);
  strip(9, .8, 0, -6, 4, 0xffffff, 4); strip(5, 4, 0, 2, 10, 0x8fb0ff, 2.4); strip(4, 1.2, 6, -3, -7, 0xc39bff, 3); strip(3, 3, -6, 4, -6, 0x7fe9ff, 2);
  scene.environment = pmrem.fromScene(env, .02).texture;

  const chrome = new THREE.MeshPhysicalMaterial({color: 0xffffff, metalness: 1, roughness: .07, envMapIntensity: 1.25, clearcoat: 1, clearcoatRoughness: .05});
  const wingMats = [0, 1].map(() => new THREE.MeshPhysicalMaterial({color: 0xe4ebff, metalness: 1, roughness: .16, envMapIntensity: 1,
    iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 820]}));

  const rig = new THREE.Group();
  scene.add(rig);

  // лампочка: колба (хром, когда выключена; светящееся стекло, когда включена), спираль и цоколь
  const prof = [];
  for (let i = 0; i <= 28; i++) { const a = Math.PI * i / 28 * .78; prof.push(new THREE.Vector2(Math.sin(a) * 1.15, 1.05 + Math.cos(a) * 1.15)); }
  prof.push(new THREE.Vector2(.78, .05), new THREE.Vector2(.56, -.45), new THREE.Vector2(.5, -.72));
  const glassMat = new THREE.MeshPhysicalMaterial({color: 0xffffff, metalness: 1, roughness: .05, envMapIntensity: 1.3, clearcoat: 1,
    transparent: true, opacity: 1, emissive: new THREE.Color(0), emissiveIntensity: 1});
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(Math.max(p.x, .001), p.y)), 64), glassMat);
  const coreMat = new THREE.MeshBasicMaterial({color: new THREE.Color(1, .8, .5), transparent: true, opacity: 0});
  const core = new THREE.Mesh(new THREE.SphereGeometry(.62, 32, 16), coreMat);
  core.position.y = 1.05;
  const fil = new THREE.CatmullRomCurve3([[-.28, -.4], [-.28, .55], [-.18, .95], [-.06, .7], [.06, .95], [.18, .7], [.28, .95], [.28, .55], [.28, -.4]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const filMat = new THREE.MeshBasicMaterial({color: 0x666a77});
  const filament = new THREE.Mesh(new THREE.TubeGeometry(fil, 80, .035, 8), filMat);
  const baseProf = [new THREE.Vector2(.5, -.72)];
  for (let i = 0; i < 6; i++) { const y = -.78 - i * .14; baseProf.push(new THREE.Vector2(.55, y), new THREE.Vector2(.47, y - .07)); }
  baseProf.push(new THREE.Vector2(.42, -1.66), new THREE.Vector2(.16, -1.86), new THREE.Vector2(.001, -1.9));
  const base = new THREE.Mesh(new THREE.LatheGeometry(baseProf, 48), chrome);
  const bulb = new THREE.Group();
  bulb.add(glass, core, filament, base);
  bulb.position.y = -.1;
  rig.add(bulb);
  const light = new THREE.PointLight(0xffffff, 0, 12, 1.6);
  light.position.set(0, 1, 1.5);
  rig.add(light);

  // крылья: три ряда перьев, каждое на своём шарнире — раскрываются веером, когда свет включён
  const feather = (len, wid) => {
    const s = new THREE.Shape();
    s.moveTo(-wid * .28, 0);
    s.quadraticCurveTo(-wid * 1.05, len * .55, -wid * .05, len);
    s.quadraticCurveTo(wid * .75, len * .5, wid * .28, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {depth: .03, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 3, curveSegments: 10});
    g.translate(0, 0, -.05);
    return g;
  };
  const ROWS = [
    {n: 10, len: [3.3, 1.9], wid: .42, folded: [168, 150], open: [-8, 112], z: -.12},
    {n: 9, len: [2.0, 1.25], wid: .4, folded: [165, 145], open: [6, 118], z: 0},
    {n: 7, len: [1.15, .8], wid: .36, folded: [160, 140], open: [22, 128], z: .1},
  ];
  const wings = [1, -1].map((side, wi) => {
    const wingMat = wingMats[wi === 0 ? 1 : 0];   // правое крыло (side 1) — «Лампа 2», левое — «Лампа 1»
    const g = new THREE.Group(), feathers = [];
    ROWS.forEach((row, r) => {
      for (let i = 0; i < row.n; i++) {
        const t = i / (row.n - 1), len = row.len[0] + (row.len[1] - row.len[0]) * t;
        const pivot = new THREE.Group(), m = new THREE.Mesh(feather(len, row.wid), wingMat);
        m.rotation.y = (t - .5) * .5;
        pivot.add(m); pivot.position.z = row.z + i * .004;
        g.add(pivot);
        feathers.push({pivot, folded: row.folded[0] + (row.folded[1] - row.folded[0]) * t, open: row.open[0] + (row.open[1] - row.open[0]) * t, r, t});
      }
    });
    g.position.set(side * .95, 1.2, -.35);
    g.scale.set(side, 1, 1);
    g.rotation.y = side * .45;
    rig.add(g);
    return {g, feathers};
  });

  // хромовые звёзды ✦ вокруг и большая звезда позади
  // четырёхлучевая звезда с вогнутыми сторонами; c — насколько тонкие лучи
  const starShape = (R, c) => {
    const s = new THREE.Shape(), tip = i => { const a = Math.PI / 2 - i * Math.PI / 2; return [Math.cos(a) * R, Math.sin(a) * R]; };
    s.moveTo(...tip(0));
    for (let i = 0; i < 4; i++) { const a = Math.PI / 2 - i * Math.PI / 2 - Math.PI / 4; s.quadraticCurveTo(Math.cos(a) * c, Math.sin(a) * c, ...tip((i + 1) % 4)); }
    return new THREE.ExtrudeGeometry(s, {depth: .05, bevelEnabled: true, bevelThickness: .08, bevelSize: .06, bevelSegments: 4, curveSegments: 12});
  };
  const stars = [];
  const big = new THREE.Mesh(starShape(2.3, .32), chrome);
  big.position.set(0, 1.1, -4.5);
  big.scale.setScalar(1);
  rig.add(big);
  [[-3.1, 3.2, -.5, .45], [3.0, 2.6, .4, .32], [-2.6, -1.6, .8, .26], [2.8, -1.2, -1, .4], [-.4, 4.0, -1.5, .22], [1.6, 4.2, .2, .18]].forEach(([x, y, z, s], i) => {
    const m = new THREE.Mesh(starShape(1, .14), chrome);
    m.position.set(x, y, z); m.scale.setScalar(s);
    rig.add(m); stars.push({m, y, phase: i * 1.7, spin: .3 + i * .07});
  });

  // искры: точки-звёздочки, мерцают
  const sprite = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(200,220,255,.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = "#fff"; x.fillRect(31, 4, 2, 56); x.fillRect(4, 31, 56, 2);
    return new THREE.CanvasTexture(c);
  })();
  const N = 260, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 14; pos[i * 3 + 1] = (Math.random() - .5) * 11 + 1; pos[i * 3 + 2] = (Math.random() - .5) * 6 - 2; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pmat = new THREE.PointsMaterial({size: .22, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xbfd0ff});
  const sparks = new THREE.Points(pg, pmat);
  scene.add(sparks);

  // постобработка: свечение и глитч (сдвиг каналов и полосы) на переключениях
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .4, .32, 1.05);
  composer.addPass(bloom);
  const glitchPass = new ShaderPass({
    uniforms: {tDiffuse: {value: null}, amount: {value: 0}, time: {value: 0}},
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float time; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float band = step(.86, rnd(vec2(floor(uv.y * 24.0), floor(time * 18.0))));
        uv.x += (rnd(vec2(floor(uv.y * 24.0), time)) - .5) * .12 * band * amount;
        float o = .012 * amount;
        vec4 c = texture2D(tDiffuse, uv);
        c.r = texture2D(tDiffuse, uv + vec2(o, 0.0)).r;
        c.b = texture2D(tDiffuse, uv - vec2(o, 0.0)).b;
        gl_FragColor = c;
      }`,
  });
  composer.addPass(glitchPass);
  composer.addPass(new OutputPass());
  // свечение делает кадр непрозрачным; возвращаем прозрачность по яркости, чтобы под сценой были видны арка и облака
  composer.addPass(new ShaderPass({
    uniforms: {tDiffuse: {value: null}},
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b)); float a = clamp((m - 0.05) * 1.8, 0.0, 1.0); gl_FragColor = vec4(c.rgb * smoothstep(0.02, 0.12, m), a); }",
  }));

  // ---------- состояние и анимация ----------
  const want = {on: 0, rgb: [140, 160, 255], sides: [[140, 160, 255], [140, 160, 255]], bright: 0};
  const now = {on: 0, spread: 0, color: new THREE.Color(.55, .63, 1), sides: [new THREE.Color(.55, .63, 1), new THREE.Color(.55, .63, 1)], bright: 0};
  const toColor = c => new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
  let yaw = 0, yawVel = 0, pointerX = 0, pointerY = 0, glitchAmt = 0, raf = 0, running = true, last = performance.now();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fps = {frames: 0, since: performance.now()};

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w * dpr / 2, h * dpr / 2);
    camera.aspect = w / h;
    camera.position.z = w / h < .9 ? 19 : 15;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();

  const ease = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    const time = t / 1000;
    fps.frames++;
    if (t - fps.since > 1000) { window.__y2kFps = Math.round(fps.frames * 1000 / (t - fps.since)); fps.frames = 0; fps.since = t; }

    now.on = ease(now.on, want.on, 4, dt);
    now.bright = ease(now.bright, want.bright, 3, dt);
    now.color.lerp(toColor(want.rgb), 1 - Math.exp(-4 * dt));
    now.sides.forEach((c, i) => c.lerp(toColor(want.sides[i]), 1 - Math.exp(-4 * dt)));
    const spreadWant = want.on ? .38 + .62 * want.bright / 100 : 0;
    now.spread = ease(now.spread, spreadWant, 2.6, dt);

    // крылья: веер от сложенного к раскрытому, лёгкий взмах; у каждого ряда своя задержка — волна по перьям
    const flap = reduced ? 0 : Math.sin(time * 1.7) * .05 * now.spread;
    for (const w of wings) for (const f of w.feathers) {
      const s = Math.min(1, Math.max(0, now.spread * (1.12 - f.r * .06) - f.t * .05 + flap * (1 + f.t)));
      f.pivot.rotation.z = -THREE.MathUtils.degToRad(f.folded + (f.open - f.folded) * s);
      f.pivot.rotation.x = Math.sin(time * 1.7 + f.t * 2) * .04 * now.spread;
    }
    // стекло: хром → светящееся стекло цвета ламп
    const lit = now.on, glow = .25 + .75 * now.bright / 100;
    glassMat.metalness = 1 - lit * .95;
    glassMat.roughness = .05 + lit * .1;
    glassMat.opacity = 1 - lit * .45;
    glassMat.emissive.copy(now.color).multiplyScalar(lit * glow * .45);
    coreMat.color.copy(now.color).multiplyScalar(1.1 + 1.3 * glow);
    coreMat.opacity = lit * .9;
    filMat.color.set(0x666a77).lerp(new THREE.Color(1, .95, .85).multiplyScalar(3), lit);
    light.color.copy(now.color); light.intensity = lit * 9 * glow;
    wingMats.forEach((m, i) => m.color.set(0xe4ebff).lerp(now.sides[i].clone().lerp(new THREE.Color(1, 1, 1), .35), lit * .55));
    bloom.strength = .2 + lit * .35 * glow;
    pmat.opacity = .35 + .45 * (.5 + .5 * Math.sin(time * 2.3)) * (.4 + .6 * lit);
    pmat.color.copy(now.color).lerp(new THREE.Color(1, 1, 1), .6);

    // вращение: само покачивается, палец докручивает с инерцией, наклон за пальцем
    if (!reduced) yaw += yawVel * dt;
    yawVel *= Math.exp(-2.2 * dt);
    const idle = reduced ? 0 : Math.sin(time * .35) * .22;
    rig.rotation.y = ease(rig.rotation.y, idle + yaw + pointerX * .25, 5, dt);
    rig.rotation.x = ease(rig.rotation.x, -pointerY * .12, 5, dt);
    rig.position.y = reduced ? 0 : Math.sin(time * 1.1) * .08;
    big.rotation.z = time * .08;
    for (const s of stars) {
      s.m.rotation.y = time * s.spin; s.m.rotation.z = Math.sin(time * .5 + s.phase) * .3;
      s.m.position.y = s.y + (reduced ? 0 : Math.sin(time * .9 + s.phase) * .15);
    }
    sparks.rotation.y = time * .02;

    glitchAmt = Math.max(0, glitchAmt - dt * 3.2);
    glitchPass.uniforms.amount.value = glitchAmt;
    glitchPass.uniforms.time.value = time;
    composer.render(dt);
  }
  raf = requestAnimationFrame(frame);
  if (location.hostname === "localhost") window.__y2kDebug = {renderer, scene, camera, composer, rig, want, now: () => now, frame};
  const vis = () => { running = !document.hidden; last = performance.now(); };
  document.addEventListener("visibilitychange", vis);

  // палец: тап по лампочке — вкл/выкл, свайп по горизонтали — повернуть с инерцией
  const ray = new THREE.Raycaster();
  let down = null;
  const el = renderer.domElement;
  el.addEventListener("pointerdown", e => { down = {x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX}; });
  el.addEventListener("pointermove", e => {
    const b = el.getBoundingClientRect();
    pointerX = ((e.clientX - b.left) / b.width - .5) * 2; pointerY = ((e.clientY - b.top) / b.height - .5) * 2;
    if (down) {
      const dx = e.clientX - down.lx; down.lx = e.clientX;
      yaw += dx * .008; yawVel = dx * .5;
    }
  });
  el.addEventListener("pointerup", e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 350;
    down = null;
    if (moved > 10 || !quick) return;
    const b = el.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), camera);
    if (ray.intersectObjects([glass, base, core, ...wings.map(w => w.g)], true).length) onTap();
  });
  el.addEventListener("pointerleave", () => { pointerX = pointerY = 0; down = null; });

  return {
    setState(s) {
      if (!!s.on !== !!want.on) glitchAmt = Math.max(glitchAmt, .8);
      want.on = s.on ? 1 : 0; want.rgb = s.rgb; want.sides = s.sides; want.bright = s.bright;
    },
    glitch() { glitchAmt = 1; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", vis);
      scene.traverse(o => { o.geometry?.dispose(); });
      [chrome, ...wingMats, glassMat, coreMat, filMat, pmat].forEach(m => m.dispose());
      sprite.dispose(); composer.dispose?.(); pmrem.dispose(); renderer.dispose(); el.remove();
    },
  };
}
