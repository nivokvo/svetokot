// API Яндекс Умного дома: чтение состояния ламп и команды.
// Документация: https://yandex.ru/dev/dialogs/smart-home/doc/concepts/platform-user-info.html

const API = "https://api.iot.yandex.net/v1.0";
const CACHE_MS = 2000;  // состояние ламп кешируем на 2 с, чтобы Mini App и cron не долбили API

export const SCENES = ["candle", "ocean", "romance", "night", "dinner", "garland", "rest"];

// Ошибка с текстом для человека: её показываем в Mini App и в боте как есть.
export class LampError extends Error {
  constructor(message, code) { super(message); this.human = true; this.code = code; }
}

let cache = null;  // {at, info} — в пределах одного экземпляра воркера
export const forget = () => { cache = null; };

async function call(env, method, path, body) {
  const r = await fetch(API + path, {method, headers: {authorization: `Bearer ${env.YANDEX_TOKEN}`, "content-type": "application/json"},
    body: body ? JSON.stringify(body) : undefined});
  if (r.status === 401 || r.status === 403) throw new LampError("Нужен новый токен Яндекса: старый истёк или отозван.", "token");
  if (r.status === 429) throw new LampError("Яндекс просит подождать: слишком много команд подряд.", "rate");
  if (!r.ok) throw new LampError("Умный дом Яндекса не ответил. Попробуйте ещё раз.", "http");
  const data = await r.json();
  if (data.status && data.status !== "ok") throw new LampError("Умный дом Яндекса вернул ошибку. Попробуйте ещё раз.", "api");
  return data;
}

async function info(env, fresh) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.info;
  const data = await call(env, "GET", "/user/info");
  cache = {at: Date.now(), info: data};
  return data;
}

const capOf = (dev, type) => dev.capabilities?.find(c => c.type === type);

// Состояние одной лампы в удобном виде: mode = "temp" | "hsv" | "scene".
export function parseLamp(dev) {
  if (!dev) return {online: false};
  const on = capOf(dev, "devices.capabilities.on_off")?.state?.value;
  const bright = capOf(dev, "devices.capabilities.range")?.state?.value;
  const color = capOf(dev, "devices.capabilities.color_setting")?.state;
  const s = {online: true, on: !!on, bright: bright ?? 100, mode: "temp", temp: 4000};
  if (color?.instance === "temperature_k") s.temp = color.value;
  else if (color?.instance === "hsv") { s.mode = "hsv"; s.hsv = color.value; }
  else if (color?.instance === "scene") { s.mode = "scene"; s.scene = color.value; }
  return s;
}

// Состояние ламп из env.LAMPS (id через запятую) в порядке «Лампа 1», «Лампа 2».
export async function lamps(env, fresh = false) {
  const ids = lampIds(env), data = await info(env, fresh);
  return ids.map(id => ({id, ...parseLamp(data.devices?.find(d => d.id === id))}));
}
export const lampIds = env => env.LAMPS.split(",").map(s => s.trim());

// Действия Яндекса для команды Mini App. cmd = {kind, value}.
export function actionsFor(cmd) {
  const on = v => ({type: "devices.capabilities.on_off", state: {instance: "on", value: v}});
  const bright = v => ({type: "devices.capabilities.range", state: {instance: "brightness", value: clamp(Math.round(v), 1, 100)}});
  const color = (instance, value) => ({type: "devices.capabilities.color_setting", state: {instance, value}});
  const v = cmd.value;
  switch (cmd.kind) {
    case "on": return [on(true)];
    case "off": return [on(false)];
    case "bright": return [on(true), bright(v)];
    case "temp": return [on(true), color("temperature_k", clamp(Math.round(v.k), 1500, 9000)), ...(v.b ? [bright(v.b)] : [])];
    case "hsv": return [on(true), color("hsv", {h: clamp(Math.round(v.h), 0, 360), s: clamp(Math.round(v.s), 0, 100), v: 100}),
                        ...(v.b ? [bright(v.b)] : [])];
    case "scene": if (!SCENES.includes(v)) throw new LampError("Такой сцены нет."); return [on(true), color("scene", v)];
    case "night": return [on(true), color("scene", "candle")];
    default: throw new LampError("Неизвестная команда.");
  }
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, Number(x) || a));

// Отправить команду на лампы ids. С env.DRY_RUN = "1" (локальная проверка) ничего не отправляет.
export async function send(env, ids, cmd) {
  const actions = actionsFor(cmd);
  if (env.DRY_RUN === "1") { console.log("DRY_RUN", ids, JSON.stringify(actions)); patchCache(ids, cmd); return; }
  const res = await call(env, "POST", "/devices/actions", {devices: ids.map(id => ({id, actions}))});
  const bad = (res.devices || []).flatMap(d => (d.capabilities || []).map(c => c.state?.action_result).filter(r => r && r.status !== "DONE"));
  patchCache(ids, cmd);
  if (bad.length) {
    const unreachable = bad.some(r => /UNREACHABLE|OFFLINE|NOT_FOUND/i.test(r.error_code || ""));
    throw new LampError(unreachable ? "Лампа не в сети: проверьте, что она включена в розетку." : "Лампа не выполнила команду. Попробуйте ещё раз.", "action");
  }
}

// После команды правим кеш, чтобы следующий /api/state сразу показал новое состояние, а не старое из Яндекса.
function patchCache(ids, cmd) {
  if (!cache) return;
  cache.at = Date.now();
  for (const dev of cache.info.devices || []) {
    if (!ids.includes(dev.id)) continue;
    for (const a of actionsFor(cmd)) {
      const c = capOf(dev, a.type);
      if (c) c.state = {...a.state};
    }
  }
}
