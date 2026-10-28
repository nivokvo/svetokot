// Y2K-тема Светокота: своя раскладка поверх общего ядра Mini App (window.App в app.html).
// Экран в рамке из жидкого хрома, внутри — настоящая 3D-лампочка: рендер лучами (raymarching) в одном шейдере, без библиотек.
// Верх колбы — зеркальный хром, который медленно стекает каплями; низ светится цветом ламп (в режиме «Обе» — двумя цветами).
// Управление простое: свайп по лампе вверх-вниз — яркость, тап — вкл/выкл, вбок — покрутить; ниже хромовые ползунки.

// Фирменные сцены темы: у двух ламп разные цвета (палитра постеров 2000-х: ультрамарин, ледяной, фиолет, оранжевый).
const SIGNATURE = [
  {name: "ICE ANGEL", list: [{lamps: [0, 1], kind: "hsv", value: {h: 205, s: 35, b: 85}}]},
  {name: "ULTRAVIOLET", list: [{lamps: [0], kind: "hsv", value: {h: 262, s: 100, b: 70}}, {lamps: [1], kind: "hsv", value: {h: 292, s: 85, b: 70}}]},
  {name: "2000 DUO", list: [{lamps: [0], kind: "hsv", value: {h: 228, s: 95, b: 80}}, {lamps: [1], kind: "hsv", value: {h: 22, s: 95, b: 80}}]},
  {name: "CYBER", list: [{lamps: [0], kind: "hsv", value: {h: 185, s: 100, b: 75}}, {lamps: [1], kind: "hsv", value: {h: 315, s: 90, b: 75}}]},
  {name: "CHROME", list: [{lamps: [0, 1], kind: "temp", value: {k: 7000, b: 100}}]},
];
const YANDEX = {ocean: "Океан", romance: "Романтика", night: "Ночь", dinner: "Ужин", garland: "Гирлянда", rest: "Отдых"};
const WHITES = [[2200, "СВЕЧА"], [2700, "ТЁПЛЫЙ"], [4000, "НЕЙТР."], [5500, "ДЕНЬ"], [6500, "ХОЛОД"]];
const patchOf = (kind, v) => kind === "hsv" ? {mode: "hsv", hsv: {h: v.h, s: v.s, v: 100}, bright: v.b || 100}
  : kind === "temp" ? {mode: "temp", temp: v.k, bright: v.b || 100} : {mode: "scene", scene: kind === "night" ? "candle" : v};

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap");
html[data-theme="y2k"] { --bg: #000; --text: #e9ecf6; --hint: #8f99c9; --accent: #6f86ff; --accent-text: #fff; --danger: #ff5c8a;
  --card: rgba(160,180,255,.07); --card2: rgba(160,180,255,.13); --line: rgba(160,180,255,.18); }
html[data-theme="y2k"] body { padding: 0; background: #000; overflow: hidden; }
.y2k { --lamp: 150,165,255; --lit: 0; position: relative; height: var(--tg-viewport-stable-height, 100dvh); min-height: 540px;
  display: flex; flex-direction: column; background: #000; color: #e9ecf6; overflow: hidden;
  font: 12px/1.3 "JetBrains Mono", ui-monospace, monospace; user-select: none; -webkit-user-select: none; }
.y2k * { box-sizing: border-box; }
.y2k button { font: inherit; color: inherit; }
.y2k-bar { flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 8px 16px 4px; font-size: 11px; letter-spacing: 1.5px; color: #8f99c9; }
.y2k-bar b { color: #fff; font-weight: 800; letter-spacing: 2px; }
.y2k-bar i { font-style: normal; color: rgb(var(--lamp)); text-shadow: 0 0 8px rgb(var(--lamp)); }

/* ---------- экран: WebGL-холст рисует и лампу, и хромовую рамку ---------- */
.y2k-screen { position: relative; flex: 1 1 auto; min-height: 250px; margin: 0 8px; touch-action: none; cursor: grab; }
.y2k-screen canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.y2k-spec { position: absolute; left: 30px; top: 28px; z-index: 2; pointer-events: none; font-size: 10px; line-height: 1.45; color: #9aa6ff;
  text-shadow: 0 0 6px rgba(110,130,255,.6); white-space: pre; }
.y2k-spec b { color: #e9ecf6; font-weight: 600; }
.y2k-tag { position: absolute; right: 30px; top: 28px; z-index: 2; pointer-events: none; font-size: 10px; color: #9aa6ff; text-align: right; line-height: 1.45; }
.y2k-big { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); z-index: 3; text-align: center; pointer-events: none;
  font: 800 64px/1 "JetBrains Mono", monospace; letter-spacing: -2px; opacity: 0; transition: opacity .25s;
  background: linear-gradient(180deg, #fff 0%, #dfe4f2 40%, #6c7386 52%, #f4f6fb 64%, #a7aebe 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 14px rgba(var(--lamp), .8)); }
.y2k-big.on { opacity: 1; }
.y2k-hint { position: absolute; left: 0; right: 0; bottom: 64px; z-index: 3; text-align: center; pointer-events: none; font-size: 10px; letter-spacing: 1px;
  color: rgba(230,236,255,.75); transition: opacity .6s; }
.y2k-seg { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 3; display: flex; padding: 3px; gap: 2px; border-radius: 999px;
  background: rgba(10,12,22,.75); box-shadow: inset 0 0 0 1px rgba(190,200,255,.22); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.y2k-seg button { border: 0; background: none; border-radius: 999px; padding: 6px 12px; font-size: 10px; font-weight: 600; letter-spacing: 1px; color: #aab3dc; cursor: pointer; white-space: nowrap; }
.y2k-seg button.on { color: #11131a; background: linear-gradient(180deg, #fff 0%, #d5d9e4 45%, #8c92a1 52%, #e3e6ee 100%); box-shadow: 0 0 12px rgba(var(--lamp), .6); }

/* ---------- пульт ---------- */
.y2k-ctl { flex: 0 0 auto; padding: 10px 16px calc(8px + env(safe-area-inset-bottom)); display: grid; gap: 10px; }
.y2k-row { display: flex; align-items: center; gap: 12px; }
.y2k-power { flex: 0 0 auto; width: 58px; height: 58px; border-radius: 50%; border: 0; cursor: pointer; position: relative; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 30%, #fff 0%, #dde1ea 32%, #868c9b 68%, #cfd3dd 100%);
  box-shadow: inset 0 -3px 6px rgba(0,0,0,.35), 0 6px 16px rgba(0,0,0,.7), 0 0 0 1px #3a3e4a; transition: transform .12s, box-shadow .4s; }
.y2k-power:active { transform: scale(.92); }
.y2k-power svg { width: 24px; height: 24px; }
.y2k.lit .y2k-power { box-shadow: inset 0 -3px 6px rgba(0,0,0,.35), 0 6px 16px rgba(0,0,0,.7), 0 0 0 1px #3a3e4a, 0 0 22px rgba(var(--lamp), .9); }
.y2k-power .st { position: absolute; bottom: -15px; font-size: 9px; font-weight: 800; letter-spacing: 1.5px; color: #8f99c9; }
.y2k.lit .y2k-power .st { color: rgb(var(--lamp)); }
.y2k-sl { flex: 1; min-width: 0; }
.y2k-sl .lb { display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 1.5px; color: #8f99c9; margin-bottom: 6px; }
.y2k-sl .lb b { color: #fff; font-weight: 800; }
.y2k input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 26px; margin: 0; background: none; cursor: pointer; --p: 50%; --g: linear-gradient(90deg, #3d4566, rgb(var(--lamp))); }
.y2k input[type=range]::-webkit-slider-runnable-track { height: 10px; border-radius: 5px;
  background: var(--g) 0 0 / var(--p) 100% no-repeat, #0b0c12; box-shadow: inset 0 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(190,200,255,.18); }
.y2k input[type=range].full::-webkit-slider-runnable-track { background: var(--g); }
.y2k input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; margin-top: -8px; border-radius: 50%; border: 0;
  background: radial-gradient(circle at 40% 30%, #fff 0%, #e4e7ef 30%, #7d8392 70%, #c6cad4 100%); box-shadow: 0 2px 6px rgba(0,0,0,.7), 0 0 10px rgba(var(--lamp), .7); }
.y2k input[type=range]::-moz-range-track { height: 10px; border-radius: 5px; background: #0b0c12; }
.y2k input[type=range]::-moz-range-progress { height: 10px; border-radius: 5px; background: rgb(var(--lamp)); }
.y2k input[type=range]::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; border: 0; background: radial-gradient(circle at 40% 30%, #fff, #7d8392 70%, #c6cad4); }
.y2k-tabs { display: flex; gap: 18px; border-bottom: 1px solid rgba(190,200,255,.14); }
.y2k-tabs button { border: 0; background: none; padding: 6px 0 8px; font-size: 11px; font-weight: 600; letter-spacing: 2px; color: #6f78a6; cursor: pointer; position: relative; }
.y2k-tabs button.on { color: #fff; }
.y2k-tabs button.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, #8c92a1, #fff, #8c92a1); box-shadow: 0 0 8px rgba(var(--lamp), .9); }
.y2k-pane { display: none; min-height: 64px; }
.y2k-pane.on { display: grid; gap: 8px; align-content: start; }
.y2k-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 2px 16px; }
.y2k-chips::-webkit-scrollbar { display: none; }
.y2k-chip { flex: 0 0 auto; border: 0; border-radius: 999px; padding: 8px 12px; font-size: 10px; font-weight: 600; letter-spacing: 1px; cursor: pointer;
  color: #dfe4f5; background: #0d0f17; box-shadow: inset 0 0 0 1px rgba(190,200,255,.2); display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.y2k-chip i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px currentColor; }
.y2k-chip.sig { background: linear-gradient(180deg, #1a1d2c, #0d0f17); box-shadow: inset 0 0 0 1px rgba(200,210,255,.35); }
.y2k-chip.on { color: #11131a; background: linear-gradient(180deg, #fff 0%, #d5d9e4 45%, #8c92a1 52%, #e3e6ee 100%); }
.y2k-chip:active { transform: scale(.95); }
.y2k-nav { display: flex; justify-content: space-between; border-top: 1px solid rgba(190,200,255,.12); padding-top: 8px; }
.y2k-nav button { border: 0; background: none; font-size: 10px; letter-spacing: 2px; color: #8f99c9; cursor: pointer; padding: 4px 2px; }
.y2k-nav button:active { color: #fff; }
.y2k-nogl { position: absolute; inset: 0; display: grid; place-items: center; color: #8f99c9; font-size: 11px; text-align: center; }

/* окна 2000-х: шторка ядра получает хромовую шапку */
html[data-theme="y2k"] .sheet { background: rgba(0,0,0,.6); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
html[data-theme="y2k"] .sheet-card { background: rgba(8,9,16,.96); border-radius: 18px 18px 0 0; padding-top: 0;
  box-shadow: 0 0 0 1px rgba(200,210,255,.25), 0 -10px 40px rgba(110,130,255,.2); animation: winopen .35s cubic-bezier(.2,.9,.3,1.15); }
html[data-theme="y2k"] .sheet-head { margin: 0 -16px 10px; padding: 10px 16px; border-radius: 18px 18px 0 0;
  background: linear-gradient(180deg, #f4f6fb 0%, #c7ccd8 48%, #8c92a0 52%, #d9dde6 100%); color: #1c1f28; }
html[data-theme="y2k"] .sheet-head b { font: 800 13px "JetBrains Mono", monospace; text-transform: lowercase; letter-spacing: 1px; }
html[data-theme="y2k"] .sheet-head b::after { content: ".exe"; opacity: .55; }
html[data-theme="y2k"] .sheet-x { background: linear-gradient(180deg, #ff9a7a, #e8432a); color: #fff; width: 24px; height: 24px; font-size: 15px; line-height: 1; }
html[data-theme="y2k"] .sheet .card { border: 1px solid rgba(160,180,255,.14); }
html[data-theme="y2k"] .toast { background: linear-gradient(180deg, #fff, #c9cdd8); color: #11131a; font: 600 12px "JetBrains Mono", monospace; }
@keyframes winopen { from { transform: translateY(30px) scale(.94); opacity: 0; } }
`;

const POWER = `<svg viewBox="0 0 24 24" fill="none" stroke="#1a1c24" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>`;

export function mount(App, root) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  root.innerHTML = `
  <div class="y2k" id="y2k">
    <div class="y2k-bar"><b>SVETOKOT.EXE</b><span><i>●</i> <span id="y2k-sys">SYSTEM ONLINE</span></span></div>
    <section class="y2k-screen" id="y2k-screen">
      <div class="y2k-spec" id="y2k-spec"></div>
      <div class="y2k-tag">光の猫<br>VOL.2000<br>✦</div>
      <div class="y2k-big" id="y2k-big"></div>
      <div class="y2k-hint" id="y2k-hint"></div>
      <div class="y2k-seg" id="y2k-seg"></div>
    </section>
    <section class="y2k-ctl">
      <div class="y2k-row">
        <button class="y2k-power" id="y2k-power" type="button" aria-label="Включить или выключить">${POWER}<span class="st" id="y2k-st">ВЫКЛ</span></button>
        <div class="y2k-sl"><div class="lb"><span>ЯРКОСТЬ</span><b id="y2k-bv">—</b></div><input type="range" id="y2k-b" min="1" max="100" value="100"></div>
      </div>
      <div class="y2k-tabs" id="y2k-tabs"><button type="button" data-t="white">БЕЛЫЙ</button><button type="button" data-t="color">ЦВЕТ</button><button type="button" data-t="scenes">СЦЕНЫ</button></div>
      <div class="y2k-pane" data-p="white">
        <div class="y2k-sl"><div class="lb"><span>ТЕПЛО</span><b id="y2k-kv">—</b></div>
          <input type="range" class="full" id="y2k-k" min="1500" max="9000" step="100" style="--g:linear-gradient(90deg,#ff8a1f,#ffc27a 22%,#fff1df 45%,#f3f5ff 62%,#bcd0ff)"></div>
        <div class="y2k-chips" id="y2k-whites"></div>
      </div>
      <div class="y2k-pane" data-p="color">
        <div class="y2k-sl"><div class="lb"><span>ОТТЕНОК</span><b id="y2k-hv">—</b></div>
          <input type="range" class="full" id="y2k-h" min="0" max="359" style="--g:linear-gradient(90deg,#f33,#fa3,#ee3,#3e5,#3de,#36f,#a3f,#f3a,#f33)"></div>
        <div class="y2k-sl"><div class="lb"><span>НАСЫЩЕННОСТЬ</span><b id="y2k-sv">—</b></div><input type="range" class="full" id="y2k-s" min="0" max="100"></div>
      </div>
      <div class="y2k-pane" data-p="scenes"><div class="y2k-chips" id="y2k-scenes"></div></div>
      <nav class="y2k-nav"><button type="button" data-a="modes">[ РЕЖИМЫ ]</button><button type="button" data-a="scenes">[ ПРЕСЕТЫ ]</button><button type="button" data-a="theme">[ ТЕМА ]</button><button type="button" data-a="settings">[ ЕЩЁ ]</button></nav>
    </section>
  </div>`;
  const $ = id => root.querySelector("#" + id);
  const el = $("y2k"), screen = $("y2k-screen");
  let tab = "white", dragging = null;
  const lit = () => App.S?.lamps && App.ids().some(i => App.S.lamps[i].on);
  const cur = () => App.shown() || {};

  const gl = createLamp(screen);

  // ---------- отрисовка ----------
  function update() {
    const S = App.S;
    if (!S) return;
    const l = cur(), on = lit(), rgb = App.lampRgb(l) || [150, 165, 255];
    const sides = App.target === "both" ? S.lamps.map(x => App.lampRgb(x) || rgb) : [rgb, rgb];
    const bright = l.mode === "scene" ? 50 : l.bright || 100;
    el.style.setProperty("--lamp", rgb.join(","));
    el.style.setProperty("--lit", on ? 1 : 0);
    el.classList.toggle("lit", on);
    gl?.set({on, bright: on ? bright : 0, c1: sides[0], c2: sides[1]});
    drawSpec(l, on, bright); drawSeg(); drawControls(l, on, bright);
  }

  function drawSpec(l, on, bright) {
    const S = App.S;
    if (S.lampsError) { $("y2k-spec").innerHTML = `<b>ERROR</b>\n${App.esc(S.lampsError).replace(/(.{28})/g, "$1\n")}`; return; }
    const who = App.target === "both" ? "L-01 + L-02" : App.target === 0 ? "L-01" : "L-02";
    const light = !on ? "—" : l.mode === "scene" ? (l.scene === "candle" ? "НОЧНИК" : (YANDEX[l.scene] || l.scene).toUpperCase())
      : l.mode === "hsv" ? `ЦВЕТ ${l.hsv.h}°` : `БЕЛЫЙ ${l.temp}K`;
    const paused = S.circ.enabled && App.ids().some(i => S.lamps[i].paused);
    const until = Math.max(...App.ids().map(i => S.lamps[i].paused || 0));
    const circ = !S.circ.enabled ? "ВЫКЛ" : paused ? `ПАУЗА${until > 1 ? " → " + App.hm(until) : ""}` : `${S.circ.k}K`;
    const off = App.ids().map(i => S.lamps[i]).filter(x => !x.online);
    $("y2k-spec").innerHTML = `SUBJECT   <b>${who}</b>\nSTATE     <b>${off.length ? "НЕ В СЕТИ" : on ? "● ON" : "○ OFF"}</b>\nLEVEL     <b>${on ? Math.round(bright) + "%" : "—"}</b>\nLIGHT     <b>${light}</b>\nCIRCADIAN <b>${circ}</b>`;
    $("y2k-sys").textContent = on ? "LIGHT ONLINE" : "STANDBY";
  }

  function drawSeg() {
    const S = App.S, opts = [[0, S.names[0]], ["both", "✦ ОБЕ"], [1, S.names[1]]];
    $("y2k-seg").innerHTML = opts.map(([k, n]) => `<button type="button" data-k="${k}" class="${App.target === k ? "on" : ""}">${App.esc(String(n).toUpperCase())}</button>`).join("");
    $("y2k-seg").querySelectorAll("button").forEach(b => b.onclick = e => { e.stopPropagation(); App.setTarget(b.dataset.k === "both" ? "both" : +b.dataset.k); });
  }

  const setRange = (input, v, min, max) => { input.value = v; input.style.setProperty("--p", ((v - min) / (max - min) * 100) + "%"); };
  function drawControls(l, on, bright) {
    $("y2k-st").textContent = on ? "ВКЛ" : "ВЫКЛ";
    if (dragging !== "b") { setRange($("y2k-b"), bright, 1, 100); $("y2k-bv").textContent = on ? Math.round(bright) + "%" : "ВЫКЛ"; }
    const k = l.mode === "temp" ? l.temp : +$("y2k-k").value || 4000;
    if (dragging !== "k") { setRange($("y2k-k"), k, 1500, 9000); $("y2k-kv").textContent = l.mode === "temp" ? k + "K" : "—"; }
    const h = l.mode === "hsv" ? l.hsv.h : +$("y2k-h").value || 0, s = l.mode === "hsv" ? l.hsv.s : +$("y2k-s").value || 100;
    if (dragging !== "h") { setRange($("y2k-h"), h, 0, 359); $("y2k-hv").textContent = l.mode === "hsv" ? h + "°" : "—"; }
    if (dragging !== "s") { setRange($("y2k-s"), s, 0, 100); $("y2k-sv").textContent = l.mode === "hsv" ? s + "%" : "—"; }
    $("y2k-s").style.setProperty("--g", `linear-gradient(90deg, #fff, ${App.css(App.hsvRgb(h, 100))})`);
    $("y2k-whites").innerHTML = WHITES.map(([kk, n]) => `<button type="button" class="y2k-chip${on && l.mode === "temp" && l.temp === kk ? " on" : ""}" data-k="${kk}"><i style="color:${App.css(App.kRgb(kk))};background:currentColor"></i>${n}</button>`).join("");
    $("y2k-whites").querySelectorAll("button").forEach(b => b.onclick = () => { App.haptic.pick(); const kk = +b.dataset.k, bb = l.bright || 100; App.cmd("temp", {k: kk, b: bb}, {mode: "temp", temp: kk, bright: bb}); });
    drawScenes(l, on);
    root.querySelectorAll(".y2k-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
    root.querySelectorAll(".y2k-pane").forEach(p => p.classList.toggle("on", p.dataset.p === tab));
  }

  function items() {
    const S = App.S;
    return [...SIGNATURE.map(x => ({...x, sig: true, dot: x.list.map(e => e.kind === "hsv" ? App.css(App.hsvRgb(e.value.h, e.value.s)) : App.css(App.kRgb(e.value.k)))})),
      {name: "НОЧНИК", key: "candle", list: [{lamps: [0, 1], kind: "night", value: null}], dot: ["#ff9a3c"]},
      ...Object.keys(YANDEX).filter(k => S.scenes.includes(k)).map(k => ({name: YANDEX[k].toUpperCase(), key: k, list: [{lamps: [0, 1], kind: "scene", value: k}], dot: [App.SCENES[k]?.[2] || "#fff"]})),
      ...(S.presets || []).map(p => ({name: p.name.toUpperCase(), list: [{lamps: [0, 1], kind: p.cmd.kind, value: p.cmd.value}], dot: ["#dfe4f5"]}))];
  }
  function drawScenes(l, on) {
    const all = items(), active = on && l.mode === "scene" ? l.scene : null;
    $("y2k-scenes").innerHTML = all.map((it, i) => `<button type="button" class="y2k-chip${it.sig ? " sig" : ""}${active && it.key === active ? " on" : ""}" data-i="${i}">${it.dot.map(c => `<i style="color:${c};background:${c}"></i>`).join("")}${App.esc(it.name)}</button>`).join("");
    $("y2k-scenes").querySelectorAll("button").forEach(b => b.onclick = () => applyItem(all[+b.dataset.i]));
  }
  function applyItem(it) {
    let list = it.list;
    if (App.target !== "both") {   // сцена на одну лампу: берём цвет, заданный для этой лампы
      const t = App.target, x = list.find(e => e.lamps.includes(t)) || list[0];
      list = [{...x, lamps: [t]}];
    }
    App.haptic.tap(); App.sound.glitch();
    App.scene(list.map(x => ({...x, patch: patchOf(x.kind, x.value)})));
    gl?.ripple();
  }

  // ---------- управление ----------
  function toggle() {
    if (!App.S?.lamps) return;
    App.haptic.tap();
    App.cmd(lit() ? "off" : "on");
    gl?.ripple();
  }
  $("y2k-power").onclick = toggle;
  root.querySelectorAll(".y2k-tabs button").forEach(b => b.onclick = () => { tab = b.dataset.t; App.haptic.pick(); App.sound.pick(); App.store.set("y2kTab", tab); update(); });
  root.querySelectorAll(".y2k-nav button").forEach(b => b.onclick = () => {
    App.haptic.pick();
    ({modes: App.openModes, scenes: App.openScenes, theme: App.openThemes, settings: App.openSettings})[b.dataset.a]();
  });
  App.store.get("y2kTab").then(t => { if (["white", "color", "scenes"].includes(t)) { tab = t; update(); } });

  // ползунки: картинка меняется сразу, команда уходит, когда палец отпущен
  function slider(id, key, preview, commit, label) {
    const input = $(id);
    let lastTick = null;
    input.addEventListener("input", () => {
      dragging = key; App.dragging = true;
      const v = +input.value;
      input.style.setProperty("--p", ((v - input.min) / (input.max - input.min) * 100) + "%");
      $(label).textContent = key === "b" ? v + "%" : key === "k" ? v + "K" : key === "h" ? v + "°" : v + "%";
      const step = Math.round(v / (key === "k" ? 250 : key === "h" ? 15 : 5));
      if (step !== lastTick) { lastTick = step; App.sound.tick(); App.haptic.pick(); }
      if (lit()) App.preview(preview(v));
    });
    input.addEventListener("change", () => {
      dragging = null; App.dragging = false;
      if (!lit() && key !== "b") return;
      commit(+input.value);
    });
  }
  slider("y2k-b", "b", v => ({bright: v}), v => App.cmd("bright", v, {bright: v}), "y2k-bv");
  slider("y2k-k", "k", v => ({mode: "temp", temp: v}), v => { const b = cur().bright || 100; App.cmd("temp", {k: v, b}, {mode: "temp", temp: v, bright: b}); }, "y2k-kv");
  const hs = () => ({h: +$("y2k-h").value, s: +$("y2k-s").value, b: cur().bright || 100});
  const sendHs = () => { const x = hs(); App.cmd("hsv", x, {mode: "hsv", hsv: {h: x.h, s: x.s, v: 100}, bright: x.b}); };
  slider("y2k-h", "h", v => ({mode: "hsv", hsv: {h: v, s: +$("y2k-s").value, v: 100}}), sendHs, "y2k-hv");
  slider("y2k-s", "s", v => ({mode: "hsv", hsv: {h: +$("y2k-h").value, s: v, v: 100}}), sendHs, "y2k-sv");

  // экран: тап — вкл/выкл, вертикальный свайп — яркость, горизонтальный — покрутить лампу
  let down = null;
  screen.addEventListener("pointerdown", e => {
    if (e.target.closest(".y2k-seg") || !App.S?.lamps) return;
    screen.setPointerCapture(e.pointerId);
    down = {x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now(), mode: null, b0: cur().bright || 100};
  });
  screen.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.mode && Math.hypot(dx, dy) > 10) down.mode = Math.abs(dy) > Math.abs(dx) && lit() ? "bright" : "spin";
    if (down.mode === "spin") { gl?.spin((e.clientX - down.lx) * .012); down.lx = e.clientX; }
    if (down.mode === "bright") {
      const v = Math.round(Math.min(100, Math.max(1, down.b0 - dy / screen.clientHeight * 160)));
      if (v !== down.v) {
        if (down.tv == null || Math.abs(v - down.tv) >= 5) { App.sound.tick(); App.haptic.pick(); down.tv = v; }
        down.v = v; App.dragging = true; App.preview({bright: v});
      }
      $("y2k-big").textContent = v + "%"; $("y2k-big").classList.add("on");
    }
  });
  const end = e => {
    if (!down) return;
    const d = down; down = null; App.dragging = false;
    $("y2k-big").classList.remove("on");
    if (d.mode === "bright" && d.v != null) return App.cmd("bright", d.v, {bright: d.v});
    if (!d.mode && e.type === "pointerup" && performance.now() - d.t < 450) toggle();
  };
  screen.addEventListener("pointerup", end);
  screen.addEventListener("pointercancel", end);

  App.store.get("y2kHint3").then(seen => {
    if (seen === "1") return;
    $("y2k-hint").textContent = "ТАП — ВКЛ/ВЫКЛ   ↕ ЯРКОСТЬ   ↔ ПОКРУТИТЬ";
    setTimeout(() => { $("y2k-hint").style.opacity = 0; App.store.set("y2kHint3", "1"); }, 7000);
  });

  return {update, unmount() { gl?.dispose(); style.remove(); root.innerHTML = ""; }};
}

// ---------- WebGL: лампа лучами + рамка из жидкого хрома, один полноэкранный шейдер ----------
const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime, uYaw, uLit, uBright, uRipple, uScale;
uniform vec3 uC1, uC2;
#define PI 3.14159265

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float sdCone(vec3 p, float h, float r1, float r2){
  vec2 q = vec2(length(p.xz), p.y), k1 = vec2(r2, h), k2 = vec2(r2 - r1, 2. * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0., 1.);
  float s = (cb.x < 0. && ca.y < 0.) ? -1. : 1.;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
// радиус колбы на высоте y — чтобы капли бежали по поверхности стекла
float glassR(float y){ return y > .12 ? sqrt(max(0., 1. - (y - .55) * (y - .55))) : mix(.44, .78, clamp((y + .45) / .57, 0., 1.)); }
// жидкий хром сверху колбы: граница опускается потёками, они медленно тянутся и подтягиваются обратно
float crown(vec3 p){
  float a = atan(p.x, p.z), line = .66 + .025 * sin(a * 6. + uTime * .5), d = 0.;
  for (int i = 0; i < 6; i++) {
    float fi = float(i), ang = fi * 1.0472 + .35 * sin(fi * 2.3);
    float da = abs(mod(a - ang + PI, 2. * PI) - PI), w = .13 + .05 * sin(fi * 1.7);
    float len = (.18 + .5 * (.5 + .5 * sin(uTime * (.22 + fi * .03) + fi * 1.9))) * (1. - fi * .07);
    d = max(d, len * sqrt(max(0., 1. - (da / w) * (da / w))));
  }
  return smoothstep(line - d - .012, line - d + .012, p.y);
}
vec3 dropPos(float fi){
  float ang = fi * 2.0944 + .6, ph = fract(uTime * .07 + fi * .37), y = .35 - ph * .85;
  float r = glassR(y) + .045;
  return vec3(sin(ang) * r, y, cos(ang) * r);
}
// x — расстояние, y — материал: 0 стекло, 1 хром
vec2 map(vec3 p){
  p.xz *= rot(uYaw);
  p.y += .12;
  float wob = uRipple * .03 * sin(p.y * 9. - uTime * 9.);
  float g = smin(length(p - vec3(0., .55, 0.)) - 1., sdCone(p - vec3(0., -.17, 0.), .29, .44, .79), .32) + wob;
  float m = 0.;
  if (g < .12) { m = crown(p); g -= .022 * m; }
  vec2 r = vec2(g, step(.5, m));
  float base = max(length(p.xz) - (.45 + .016 * sin(p.y * 30.)), abs(p.y + .82) - .4);
  base = smin(base, length(p - vec3(0., -1.28, 0.)) - .17, .1);
  if (base < r.x) r = vec2(base, 1.);
  if (abs(length(p.xz) - .7) < .5) for (int i = 0; i < 3; i++) {
    float fi = float(i), ph = fract(uTime * .07 + fi * .37);
    float d = length(p - dropPos(fi)) - .055 * (1. - ph * .6);
    if (d < r.x) r = vec2(d, 1.);
  }
  return r;
}
vec3 normal(vec3 p){
  vec2 e = vec2(.0015, -.0015);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}
// окружение для хрома: «хромовый горизонт» (светлое небо, тёмная полоса, сиреневый низ) + студийные полосы света
vec3 env(vec3 d){
  float y = d.y, a = atan(d.x, d.z);
  vec3 sky = mix(vec3(.5, .56, .95), vec3(1.7, 1.75, 1.9), smoothstep(.15, .85, y));
  vec3 low = mix(vec3(.03, .03, .07), vec3(.42, .36, .7), smoothstep(-.05, -.7, y));
  vec3 c = y > .03 ? mix(vec3(.05, .05, .1), sky, smoothstep(.03, .2, y)) : low;
  c += 1.8 * exp(-pow((a - .3) * 10., 2.)) + 1.1 * exp(-pow((a + .55) * 12., 2.));   // вертикальные софтбоксы — блики на цоколе
  c += 2.2 * exp(-pow((a - 1.1) * 7., 2.)) * smoothstep(-.3, .5, y);
  c += 1.6 * exp(-pow((a + 1.9) * 9., 2.)) * smoothstep(-.1, .7, y);
  c += mix(uC2, uC1, .5) * uLit * .9 * smoothstep(.2, -.6, y);
  return c;
}
// хром рамки: тёмная полоса горизонта и яркий блик, зависят только от наклона канта
vec3 bezel(vec3 n){
  float y = n.y * .85 + n.x * .25;
  vec3 c = mix(vec3(.03, .03, .06), vec3(1.5, 1.55, 1.7), smoothstep(-.05, .55, y));
  c = mix(c, vec3(.45, .42, .75), smoothstep(-.05, -.6, y) * .7);
  return c + 1.4 * exp(-pow((n.x - .4) * 7., 2.)) + .6 * exp(-pow((n.y + .5) * 6., 2.));
}
// рамка экрана: хромовый кант с «оплывшим» внутренним краем и подтёками сверху
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float frameH(vec2 px){
  vec2 c = uRes * .5, q = px - c;
  float o = rbox(q, c - 3. * uScale, 30. * uScale);
  float melt = 3. * uScale * sin(px.x * .045 / uScale + 1.4 * sin(px.y * .03 / uScale + uTime * .35))
    + 16. * uScale * exp(-pow((px.x - c.x * .55) / (10. * uScale), 2.)) * smoothstep(c.y * 1.6, uRes.y, px.y)
    + 24. * uScale * exp(-pow((px.x - c.x * 1.38) / (8. * uScale), 2.)) * smoothstep(c.y * 1.5, uRes.y, px.y);
  float w = 13. * uScale + melt;
  float t = clamp(-o / w, 0., 1.);
  return o > 0. ? -1. : (t >= 1. ? -2. : sin(t * PI));
}

void main(){
  vec2 px = gl_FragCoord.xy;
  float h = frameH(px);
  if (h == -1.) { gl_FragColor = vec4(0.); return; }
  if (h >= 0.) {
    float hx = frameH(px + vec2(1., 0.)), hy = frameH(px + vec2(0., 1.));
    hx = hx < 0. ? 0. : hx; hy = hy < 0. ? 0. : hy;
    vec3 n = normalize(vec3((h - hx) * 9. / uScale, (h - hy) * 9. / uScale, 1.));
    vec3 col = bezel(n) * vec3(.9, .92, 1.03);
    gl_FragColor = vec4(col * smoothstep(0., .08, h) + .02, 1.);
    return;
  }
  vec2 uv = (px - uRes * .5) / uRes.y;
  vec3 ro = vec3(0., .1, 9.4), rd = normalize(vec3(uv.x, uv.y - .02, -1.8));
  float t = 0., mind = 1e3; vec2 hit = vec2(-1.);
  for (int i = 0; i < 90; i++) {
    vec2 d = map(ro + rd * t);
    mind = min(mind, d.x);
    if (d.x < .0012) { hit = d; break; }
    t += d.x * .8;
    if (t > 14.) break;
  }
  vec3 c1 = uC1, c2 = uC2;
  float glow = .25 + .75 * uBright;
  // фон экрана: почти чёрный, с отсветом ламп и сеткой-полом
  vec3 bg = vec3(.006, .007, .016) + mix(c2, c1, .5) * uLit * glow * .09 * exp(-dot(uv, uv) * 5.);
  vec2 g = vec2(uv.x / max(.08, -uv.y + .02), 1. / max(.08, -uv.y + .02));
  float grid = uv.y < -.18 ? (smoothstep(.03, 0., abs(fract(g.x * .9) - .5) - .47) + smoothstep(.03, 0., abs(fract(g.y * .9 + uTime * .25) - .5) - .47)) * smoothstep(-.18, -.5, uv.y) : 0.;
  bg += vec3(.25, .3, .75) * grid * .22 + mix(c2, c1, .5) * grid * uLit * .2;
  vec3 col = bg;
  if (hit.y >= 0.) {
    vec3 p = ro + rd * t, n = normal(p), r = reflect(rd, n);
    float fres = pow(1. - max(0., dot(n, -rd)), 3.);
    vec3 pl = p; pl.xz *= rot(uYaw); pl.y += .12;
    if (hit.y > .5) {
      col = env(r) * mix(vec3(.82, .85, 1.), vec3(1.05), fres) * .9 + vec3(.06, .065, .1) + vec3(.35, .4, .65) * fres;
      col += mix(c2, c1, .5) * uLit * glow * .35 * max(0., -n.y);
    } else {
      vec3 lc = mix(c2, c1, smoothstep(-.5, 1.1, pl.y));
      float core = pow(max(0., dot(n, -rd)), 2.);
      vec3 on = lc * (.18 + 1.35 * core) * (.45 + .9 * glow) + vec3(1.) * pow(core, 8.) * .6 * glow;
      vec3 off = env(r) * (.06 + .7 * fres) + vec3(.015, .016, .03);
      col = mix(off, on + env(r) * (.06 + .45 * fres), uLit);
    }
  }
  col += mix(c2, c1, .5) * uLit * glow * .45 * exp(-mind * 7.) * (hit.y < 0. ? 1. : .2);
  col = col / (1. + col * .35);
  gl_FragColor = vec4(pow(col, vec3(.4545)), 1.);
}`;

function createLamp(box) {
  const canvas = document.createElement("canvas");
  box.prepend(canvas);
  const gl = canvas.getContext("webgl", {antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance"});
  const fallback = () => { canvas.remove(); box.insertAdjacentHTML("afterbegin", `<div class="y2k-nogl">3D недоступно на этом устройстве<br>пульт ниже работает</div>`); return null; };
  if (!gl) return fallback();
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); }
  catch (e) { console.error(e); return fallback(); }
  gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = name => gl.getUniformLocation(prog, name);
  const u = {res: U("uRes"), time: U("uTime"), yaw: U("uYaw"), lit: U("uLit"), bright: U("uBright"), ripple: U("uRipple"), scale: U("uScale"), c1: U("uC1"), c2: U("uC2")};

  // плавные значения: картинка догоняет состояние ламп, а не прыгает
  const lin = c => c.map(x => Math.pow(x / 255, 2.2));
  const want = {lit: 0, bright: 0, c1: lin([150, 165, 255]), c2: lin([150, 165, 255])};
  const now = {lit: 0, bright: 0, c1: [...want.c1], c2: [...want.c2], yaw: 0, vel: .35, ripple: 0};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let scale = Math.min(1.5, window.devicePixelRatio || 1), raf = 0, last = performance.now(), slow = 0;
  const t0 = performance.now();

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(box); resize();

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    const k = 1 - Math.exp(-dt * 4);
    now.lit += (want.lit - now.lit) * k; now.bright += (want.bright - now.bright) * k;
    for (let i = 0; i < 3; i++) { now.c1[i] += (want.c1[i] - now.c1[i]) * k; now.c2[i] += (want.c2[i] - now.c2[i]) * k; }
    // вращение: палец докручивает с инерцией, потом лампа медленно крутится сама
    now.yaw += now.vel * dt;
    now.vel += ((reduced ? 0 : .35) - now.vel) * (1 - Math.exp(-dt * 1.2));
    now.ripple *= Math.exp(-dt * 2.5);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, reduced ? 0 : (t - t0) / 1000);
    gl.uniform1f(u.yaw, now.yaw);
    gl.uniform1f(u.lit, now.lit); gl.uniform1f(u.bright, now.bright);
    gl.uniform1f(u.ripple, now.ripple); gl.uniform1f(u.scale, scale);
    gl.uniform3fv(u.c1, now.c1); gl.uniform3fv(u.c2, now.c2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // слабый телефон не тянет — снижаем разрешение рендера, но не ниже 0.6
    if (dt > .028) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 40 && scale > .6) { scale = Math.max(.6, scale * .8); slow = 0; resize(); }
    window.__y2kFps = Math.round(1 / Math.max(dt, .001));
  }
  raf = requestAnimationFrame(frame);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); });

  return {
    set(s) {
      want.lit = s.on ? 1 : 0; want.bright = s.bright / 100;
      want.c1 = lin(s.c1); want.c2 = lin(s.c2);
    },
    spin(d) { now.yaw += d; now.vel = d * 50; },
    ripple() { now.ripple = 1; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); gl.getExtension("WEBGL_lose_context")?.loseContext(); canvas.remove(); },
  };
}
