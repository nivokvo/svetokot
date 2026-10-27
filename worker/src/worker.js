// Светокот: Telegram-бот и Mini App для двух ламп Sber A70 в спальне.
// Один Worker делает всё: принимает сообщения бота (webhook), отдаёт Mini App и её API,
// а раз в минуту (cron) ведёт циркадный режим, рассвет под будильник и таймер засыпания.
// Лампами управляет через API Яндекс Умного дома (src/yandex.js), время считает src/time.js.

import {lamps, lampIds, send, forget, LampError, SCENES} from "./yandex.js";
import {minsk, sunTimes, circadianK, curve, nextSunrise, morningEnd, dawnAt, dawnLevel, nextAlarm, timerStep} from "./time.js";
import {checkInitData, webhookSecret} from "./auth.js";
import APP_HTML from "./app.html";

const SETUP_VERSION = 1;     // поменять число, чтобы cron заново прописал вебхук, команды и кнопку меню
const MIN_STEP_K = 50;       // циркадный не шлёт изменения меньше 50 K
const DRIFT_K = 150;         // лампа ушла от циркадного больше чем на 150 K — значит, её настроили вручную (Алиса, приложение)
const DEFAULTS = {names: ["Лампа 1", "Лампа 2"], circ: {enabled: false, night: 2700, day: 5500, transition: 120}};
const BUSY = "Сервис временно недоступен. Лампы можно включить через Алису или приложение Дом с Алисой.";

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/tg" && req.method === "POST") {
        if (!env.BOT_TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret(env)) return new Response("no", {status: 403});
        ctx.waitUntil(onUpdate(await req.json(), env).catch(e => alarm(env, "бот", e)));
        return new Response("ok");
      }
      if (url.pathname === "/app") return new Response(APP_HTML, {headers: {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"}});
      if (url.pathname.startsWith("/api/")) return await apiRoute(req, url, env);
      return new Response("Светокот", {status: 200});
    } catch (e) {
      // Людям в Mini App — понятный текст, а не «D1_ERROR: …». Подробности — в логах и владельцу (не чаще раза в час).
      console.error(url.pathname, e);
      if (e?.human) return json({error: e.message, code: e.code}, 502);
      ctx.waitUntil(alarm(env, url.pathname, e).catch(() => {}));
      return json({error: BUSY}, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env, event.scheduledTime || Date.now()).catch(e => alarm(env, "cron", e)));
  },
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {"content-type": "application/json; charset=utf-8"}});

// ---------- хранилище: маленькие JSON-значения в таблице kv ----------

async function kvGet(env, key, def) {
  const row = await env.DB.prepare("SELECT value FROM kv WHERE key=?").bind(key).first();
  return row ? JSON.parse(row.value) : def;
}
const kvSet = (env, key, value) => value == null
  ? env.DB.prepare("DELETE FROM kv WHERE key=?").bind(key).run()
  : env.DB.prepare("INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, JSON.stringify(value)).run();

async function settings(env) {
  const s = await kvGet(env, "settings", {});
  return {names: s.names || DEFAULTS.names, circ: {...DEFAULTS.circ, ...s.circ}};
}
const coords = env => ({lat: Number(env.LAT), lon: Number(env.LON)});

// ---------- доступ ----------

const isOwner = (env, id) => String(id) === String(env.OWNER_ID);
async function allowed(env, id) {
  if (isOwner(env, id)) return true;
  return !!await env.DB.prepare("SELECT 1 FROM users WHERE id=?").bind(Number(id)).first();
}

async function whoIs(req, env, url) {
  const init = req.headers.get("x-init-data");
  // Предпросмотр в браузере без Telegram — только при локальном `wrangler dev` (DEV=1 в .dev.vars) и только с localhost
  if (!init && env.DEV === "1" && ["localhost", "127.0.0.1"].includes(url.hostname)) return {id: Number(env.OWNER_ID), first_name: "Предпросмотр"};
  return checkInitData(init, env.BOT_TOKEN);
}

// ---------- API для Mini App ----------

async function apiRoute(req, url, env) {
  const user = await whoIs(req, env, url);
  if (!user) return json({error: "Откройте пульт из Telegram заново: сессия устарела."}, 401);
  if (!await allowed(env, user.id)) return json({error: "Нет доступа. Попросите владельца добавить вас."}, 403);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const owner = isOwner(env, user.id);
  switch (url.pathname) {
    case "/api/state": return json(await fullState(env, user, url.searchParams.has("fresh")));
    case "/api/set": return json(await apiSet(env, body));
    case "/api/settings": await saveSettings(env, body); return json(await fullState(env, user));
    case "/api/circadian": await resumeCircadian(env, Date.now()); return json(await fullState(env, user));
    case "/api/alarms": await saveAlarm(env, body); return json(await fullState(env, user));
    case "/api/timer": await saveTimer(env, body); return json(await fullState(env, user));
    case "/api/presets": await savePreset(env, body); return json(await fullState(env, user));
    case "/api/users":
      if (!owner) return json({error: "Список доступа ведёт только владелец."}, 403);
      return json(await usersApi(env, body));
  }
  return json({error: "Не найдено"}, 404);
}

// Всё, что нужно Mini App для экрана: лампы, циркадный с графиком, будильники, таймер, пресеты.
async function fullState(env, user, fresh = false) {
  const now = Date.now(), s = await settings(env), {lat, lon} = coords(env);
  const [circ, timer, presets, alarms] = await Promise.all([kvGet(env, "circ", {}), kvGet(env, "timer", null), kvGet(env, "presets", []), loadAlarms(env)]);
  let list = null, lampsError = null;
  try { list = await lamps(env, fresh); } catch (e) { if (!e.human) throw e; lampsError = e.message; }
  const p = minsk(now), sun = sunTimes(p.y, p.m, p.d, lat, lon) || {rise: 360, set: 1080};
  const pause = id => (circ.pause?.[id] > now ? circ.pause[id] : null);
  return {
    me: {id: user.id, name: user.first_name, owner: isOwner(env, user.id)},
    now, names: s.names, lampsError,
    lamps: list && list.map((l, i) => ({...l, idx: i, name: s.names[i], paused: pause(l.id)})),
    circ: {...s.circ, k: Math.round(circadianK(p.min, sun, s.circ)), sun, curve: curve(sun, s.circ, 10)},
    timer: timer && {end: timer.end, start: timer.start, lamps: timer.ids.map(id => lampIds(env).indexOf(id))},
    alarms: alarms.map(a => ({...a, next: nextAlarm(a, now)})),
    presets, scenes: SCENES,
  };
}

// cmd от Mini App: {lamps: [0, 1], kind, value}. Ручная настройка ставит циркадный на паузу до утра.
async function apiSet(env, body) {
  const ids = pickIds(env, body.lamps);
  await manual(env, ids, {kind: String(body.kind), value: body.value});
  return {lamps: (await lamps(env)).map((l, i) => ({...l, idx: i}))};
}
function pickIds(env, idx) {
  const all = lampIds(env);
  const list = (Array.isArray(idx) ? idx : [0, 1]).map(Number).filter(i => all[i]);
  if (!list.length) throw new LampError("Выберите лампу.");
  return list.map(i => all[i]);
}

// Команда человека (из Mini App или кнопкой бота). Включение при активном циркадном сразу даёт нужную температуру.
async function manual(env, ids, cmd) {
  const now = Date.now(), s = await settings(env), circ = await kvGet(env, "circ", {}), {lat, lon} = coords(env);
  circ.pause ||= {}; circ.sent ||= {};
  if (cmd.kind === "on" && s.circ.enabled) {
    const free = ids.filter(id => !(circ.pause[id] > now)), busy = ids.filter(id => circ.pause[id] > now);
    const k = circKNow(env, s, now);
    if (free.length) { await send(env, free, {kind: "temp", value: {k, b: 100}}); for (const id of free) circ.sent[id] = k; }
    if (busy.length) await send(env, busy, cmd);
  } else {
    await send(env, ids, cmd);
    if (cmd.kind === "off") {
      for (const id of ids) delete circ.sent[id];
      const timer = await kvGet(env, "timer", null);  // выключили сами — таймер больше не нужен
      if (timer && timer.ids.some(id => ids.includes(id))) await kvSet(env, "timer", null);
    } else if (cmd.kind !== "on") {
      const until = nextSunrise(now, lat, lon);
      for (const id of ids) { circ.pause[id] = until; delete circ.sent[id]; }
      await skipDawn(env, ids, now);
    }
  }
  await kvSet(env, "circ", circ);
}

function circKNow(env, s, now) {
  const p = minsk(now), {lat, lon} = coords(env), sun = sunTimes(p.y, p.m, p.d, lat, lon) || {rise: 360, set: 1080};
  return Math.round(circadianK(p.min, sun, s.circ));
}

// «Вернуть циркадный»: снимаем паузу и сразу ставим нужную температуру включённым лампам.
async function resumeCircadian(env, now) {
  const s = await settings(env);
  if (!s.circ.enabled) { s.circ.enabled = true; await kvSet(env, "settings", s); }
  await kvSet(env, "circ", {pause: {}, sent: {}});
  forget();
  await circadianStep(env, now, s, await lamps(env, true));
}

async function saveSettings(env, b) {
  const s = await settings(env);
  if (Array.isArray(b.names)) s.names = s.names.map((n, i) => String(b.names[i] ?? n).trim().slice(0, 24) || n);
  if (b.circ) {
    const c = b.circ, num = (v, a, z, d) => Number.isFinite(+v) ? Math.min(z, Math.max(a, Math.round(+v))) : d;
    const wasOn = s.circ.enabled;
    s.circ = {enabled: c.enabled ?? s.circ.enabled, night: num(c.night, 1500, 9000, s.circ.night), day: num(c.day, 1500, 9000, s.circ.day),
              transition: num(c.transition, 10, 240, s.circ.transition)};
    s.circ.enabled = !!s.circ.enabled;
    await kvSet(env, "settings", s);
    if (s.circ.enabled) {
      // включили или поменяли температуры — применяем сразу, не дожидаясь cron
      const circ = await kvGet(env, "circ", {});
      await kvSet(env, "circ", {pause: wasOn ? circ.pause || {} : {}, sent: {}});
      await circadianStep(env, Date.now(), s, await lamps(env, true));
    }
    return;
  }
  await kvSet(env, "settings", s);
}

// ---------- будильники, таймер, пресеты ----------

async function loadAlarms(env) {
  const {results} = await env.DB.prepare("SELECT id, time, days, minutes, enabled, lamps FROM alarms ORDER BY time").all();
  return results.map(a => ({...a, enabled: !!a.enabled, lamps: JSON.parse(a.lamps || "[0,1]")}));
}

async function saveAlarm(env, b) {
  if (b.op === "delete") { await env.DB.prepare("DELETE FROM alarms WHERE id=?").bind(Number(b.id)).run(); return; }
  const a = b.alarm || {};
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time || "")) throw new LampError("Время будильника в формате ЧЧ:ММ.");
  const days = Number(a.days) & 127, minutes = Math.min(60, Math.max(5, Math.round(Number(a.minutes) || 30)));
  const idx = (Array.isArray(a.lamps) ? a.lamps : [0, 1]).map(Number).filter(i => i === 0 || i === 1);
  const row = [a.time, days, minutes, a.enabled === false ? 0 : 1, JSON.stringify(idx.length ? idx : [0, 1])];
  if (a.id) await env.DB.prepare("UPDATE alarms SET time=?, days=?, minutes=?, enabled=?, lamps=? WHERE id=?").bind(...row, Number(a.id)).run();
  else {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM alarms").first();
    if (n.n >= 10) throw new LampError("Не больше 10 будильников.");
    await env.DB.prepare("INSERT INTO alarms(time, days, minutes, enabled, lamps) VALUES(?, ?, ?, ?, ?)").bind(...row).run();
  }
}

async function saveTimer(env, b) {
  if (b.cancel) { await kvSet(env, "timer", null); return; }
  const minutes = [15, 30, 60].includes(Number(b.minutes)) ? Number(b.minutes) : 30;
  const ids = pickIds(env, b.lamps), now = Date.now();
  const on = (await lamps(env)).filter(l => ids.includes(l.id) && l.on);
  if (!on.length) throw new LampError("Лампы выключены — гасить нечего.");
  const from = Math.max(...on.map(l => l.mode === "scene" ? 50 : l.bright));
  await kvSet(env, "timer", {start: now, end: now + minutes * 6e4, from, ids: on.map(l => l.id)});
  const circ = await kvGet(env, "circ", {}), {lat, lon} = coords(env);  // таймер ведёт яркость сам — циркадный ждёт утра
  circ.pause ||= {};
  for (const l of on) circ.pause[l.id] = nextSunrise(now, lat, lon);
  await kvSet(env, "circ", circ);
}

async function savePreset(env, b) {
  let list = await kvGet(env, "presets", []);
  if (b.op === "delete") list = list.filter(p => p.id !== b.id);
  else {
    const c = b.cmd || {};
    if (!["temp", "hsv", "scene"].includes(c.kind)) throw new LampError("Пресет сохраняет цвет, белый или сцену.");
    if (list.length >= 12) throw new LampError("Не больше 12 пресетов.");
    list.push({id: crypto.randomUUID().slice(0, 8), name: String(b.name || "Пресет").trim().slice(0, 20) || "Пресет", cmd: {kind: c.kind, value: c.value}});
  }
  await kvSet(env, "presets", list);
}

async function usersApi(env, b) {
  if (b.op === "add") {
    const id = Number(b.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new LampError("Telegram id — это число, например 123456789.");
    await env.DB.prepare("INSERT INTO users(id, name, added) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=COALESCE(excluded.name, users.name)")
      .bind(id, b.name ? String(b.name).slice(0, 40) : null, Date.now()).run();
  }
  if (b.op === "remove") await env.DB.prepare("DELETE FROM users WHERE id=?").bind(Number(b.id)).run();
  const {results} = await env.DB.prepare("SELECT id, name, added FROM users ORDER BY added").all();
  return {users: results};
}

// ---------- cron раз в минуту ----------

export async function tick(env, now) {
  if (env.BOT_TOKEN && env.PUBLIC_URL && (await kvGet(env, "setup", 0)) !== SETUP_VERSION) await setup(env);
  const [s, timer, alarms] = await Promise.all([settings(env), kvGet(env, "timer", null), loadAlarms(env)]);
  const dawns = alarms.map(a => ({a, d: dawnAt(a, now)})).filter(x => x.d);
  if (!s.circ.enabled && !timer && !dawns.length) return;
  const list = await lamps(env, true);
  if (dawns.length) await dawnStep(env, now, s, dawns);
  if (timer) await timerTick(env, now, timer, list);
  if (s.circ.enabled) await circadianStep(env, now, s, list);
}

// Циркадный: только включённые и не стоящие на паузе лампы, только при изменении больше 50 K.
async function circadianStep(env, now, s, list) {
  const circ = await kvGet(env, "circ", {}), {lat, lon} = coords(env), before = JSON.stringify(circ);
  circ.pause ||= {}; circ.sent ||= {};
  const k = circKNow(env, s, now), todo = [];
  for (const l of list) {
    if (!l.online) continue;
    if (!l.on) { delete circ.sent[l.id]; continue; }
    if (circ.pause[l.id] > now) continue;
    if (circ.pause[l.id]) { delete circ.pause[l.id]; delete circ.sent[l.id]; }
    const sent = circ.sent[l.id];
    // кто-то поменял свет мимо бота (Алиса, приложение) — это тоже ручная настройка: ждём утра
    if (sent != null && (l.mode !== "temp" || Math.abs(l.temp - sent) > DRIFT_K)) {
      circ.pause[l.id] = nextSunrise(now, lat, lon); delete circ.sent[l.id]; continue;
    }
    if (sent == null || Math.abs(sent - k) >= MIN_STEP_K) todo.push(l.id);
  }
  if (todo.length) {
    await send(env, todo, {kind: "temp", value: {k, b: 100}});
    for (const id of todo) circ.sent[id] = k;
  }
  if (JSON.stringify(circ) !== before) await kvSet(env, "circ", circ);
}

// Рассвет: шаг раз в минуту от 2700 K и 1% до 5500 K и 100%. Циркадный на это время на паузе.
async function dawnStep(env, now, s, dawns) {
  const skip = await kvGet(env, "dawn_skip", []), circ = await kvGet(env, "circ", {}), {lat, lon} = coords(env);
  circ.pause ||= {}; circ.sent ||= {};
  let changed = false;
  for (const {a, d} of dawns) {
    if (skip.includes(`${a.id}@${d.at}`)) continue;
    const ids = a.lamps.map(i => lampIds(env)[i]).filter(Boolean), lvl = dawnLevel(d.p, {k: 2700, b: 1}, {k: 5500, b: 100});
    await send(env, ids, {kind: "temp", value: {k: lvl.k, b: lvl.b}});
    const until = Math.max(d.at + 6e4, morningEnd(now, lat, lon, s.circ));
    for (const id of ids) { circ.pause[id] = until; delete circ.sent[id]; }
    changed = true;
  }
  if (changed) await kvSet(env, "circ", circ);
}

// Человек сам взялся за свет во время рассвета — рассвет на сегодня останавливается.
async function skipDawn(env, ids, now) {
  const alarms = await loadAlarms(env), all = lampIds(env);
  const keys = alarms.map(a => ({a, d: dawnAt(a, now)})).filter(x => x.d && x.a.lamps.some(i => ids.includes(all[i]))).map(x => `${x.a.id}@${x.d.at}`);
  if (!keys.length) return;
  const skip = (await kvGet(env, "dawn_skip", [])).filter(k => Number(k.split("@")[1]) > now - 864e5);
  await kvSet(env, "dawn_skip", [...new Set([...skip, ...keys])]);
}

// Таймер засыпания: яркость вниз, затем «Ночник», затем выключение. Трогает только включённые лампы.
async function timerTick(env, now, timer, list) {
  const step = timerStep(timer, now), on = list.filter(l => timer.ids.includes(l.id) && l.on).map(l => l.id);
  if (!on.length) { await kvSet(env, "timer", null); return; }
  if (step.action === "dim" && step.bright !== timer.last) {
    await send(env, on, {kind: "bright", value: step.bright});
    await kvSet(env, "timer", {...timer, last: step.bright});
  } else if (step.action === "night" && timer.phase !== "night") {
    await send(env, on, {kind: "night"});
    await kvSet(env, "timer", {...timer, phase: "night"});
  } else if (step.action === "off") {
    await send(env, on, {kind: "off"});
    await kvSet(env, "timer", null);
  }
}

// ---------- бот ----------

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)});
  return r.json();
}

async function setup(env) {
  const app = env.PUBLIC_URL + "/app";
  const r = {
    webhook: await tg(env, "setWebhook", {url: env.PUBLIC_URL + "/tg", secret_token: await webhookSecret(env), allowed_updates: ["message", "callback_query"]}),
    commands: await tg(env, "setMyCommands", {commands: [{command: "start", description: "Пульт и быстрые кнопки"}]}),
    menu: await tg(env, "setChatMenuButton", {menu_button: {type: "web_app", text: "Пульт", web_app: {url: app}}}),
    description: await tg(env, "setMyDescription", {description: "Пульт для ламп в спальне: цвет, белый, ночник, циркадный свет по солнцу, рассвет под будильник и таймер засыпания."}),
    short: await tg(env, "setMyShortDescription", {short_description: "Пульт для ламп в спальне"}),
  };
  if (r.webhook.ok && r.menu.ok) await kvSet(env, "setup", SETUP_VERSION);
  else console.error("setup", JSON.stringify(r));
  return r;
}

const startKb = env => ({inline_keyboard: [
  [{text: "Открыть пульт", web_app: {url: env.PUBLIC_URL + "/app"}}],
  [{text: "Включить", callback_data: "on"}, {text: "Выключить", callback_data: "off"}],
  [{text: "Ночник", callback_data: "night"}, {text: "Циркадный", callback_data: "circ"}],
]});

async function onUpdate(u, env) {
  if (u.callback_query) return onButton(u.callback_query, env);
  const m = u.message;
  if (!m?.from || m.chat.type !== "private" || !await allowed(env, m.from.id)) return;  // чужим не отвечаем
  const owner = isOwner(env, m.from.id);
  // владелец пересылает сообщение человека или его контакт — предлагаем дать доступ
  const who = m.contact?.user_id ? {id: m.contact.user_id, name: [m.contact.first_name, m.contact.last_name].filter(Boolean).join(" ")}
    : m.forward_origin?.type === "user" ? {id: m.forward_origin.sender_user.id, name: [m.forward_origin.sender_user.first_name, m.forward_origin.sender_user.last_name].filter(Boolean).join(" ")}
    : null;
  if (owner && who) {
    await kvSet(env, `pending:${who.id}`, who.name);
    return tg(env, "sendMessage", {chat_id: m.chat.id, parse_mode: "HTML", text: `Дать доступ к лампам: <b>${esc(who.name || who.id)}</b>?`,
      reply_markup: {inline_keyboard: [[{text: "Дать доступ", callback_data: `add:${who.id}`}]]}});
  }
  if (owner && (m.forward_origin || m.contact)) {
    return tg(env, "sendMessage", {chat_id: m.chat.id, text: "У этого человека скрыт аккаунт при пересылке. Добавьте его по Telegram id в пульте: Настройки → Доступ."});
  }
  await tg(env, "sendMessage", {chat_id: m.chat.id, parse_mode: "HTML", reply_markup: startKb(env),
    text: `Привет, ${esc(m.from.first_name || "")}! Я Светокот — пульт для ламп в спальне.\n\nКнопки ниже работают на обе лампы сразу, а в пульте — цвет, белый, сцены, циркадный свет, рассвет и таймер.`});
}

const DONE = {on: "Включено", off: "Выключено", night: "Ночник", circ: "Циркадный включён"};

async function onButton(q, env) {
  if (!await allowed(env, q.from.id)) return tg(env, "answerCallbackQuery", {callback_query_id: q.id});
  let text;
  try {
    if (q.data.startsWith("add:")) {
      if (!isOwner(env, q.from.id)) return tg(env, "answerCallbackQuery", {callback_query_id: q.id});
      const id = Number(q.data.slice(4)), name = await kvGet(env, `pending:${id}`, null);
      await usersApi(env, {op: "add", id, name});
      await kvSet(env, `pending:${id}`, null);
      text = "Доступ выдан";
      await tg(env, "editMessageText", {chat_id: q.message.chat.id, message_id: q.message.message_id, parse_mode: "HTML",
        text: `<b>${esc(name || id)}</b> теперь может управлять лампами. Пусть напишет боту /start.`});
    } else {
      const ids = lampIds(env);
      if (q.data === "circ") await resumeCircadianAndOn(env, ids);
      else if (DONE[q.data]) await manual(env, ids, {kind: q.data});
      text = DONE[q.data];
    }
  } catch (e) {
    if (!e.human) { await alarm(env, "кнопка", e); text = "Сервис временно недоступен"; }
    else text = e.message;
  }
  await tg(env, "answerCallbackQuery", {callback_query_id: q.id, text: text?.slice(0, 190)});
}

// Кнопка «Циркадный» в чате: включает режим, снимает паузу и зажигает лампы нужной температурой.
async function resumeCircadianAndOn(env, ids) {
  const s = await settings(env), now = Date.now();
  if (!s.circ.enabled) { s.circ.enabled = true; await kvSet(env, "settings", s); }
  const k = circKNow(env, s, now);
  await send(env, ids, {kind: "temp", value: {k, b: 100}});
  await kvSet(env, "circ", {pause: {}, sent: Object.fromEntries(ids.map(id => [id, k]))});
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Ошибки — владельцу в Telegram, не чаще раза в час. Истёкший токен Яндекса — с инструкцией.
async function alarm(env, where, e) {
  console.error(where, e);
  if (!env.BOT_TOKEN) return;
  const now = Date.now(), last = await kvGet(env, "alarm_at", 0).catch(() => 0);
  if (now - last < 3600e3) return;
  await kvSet(env, "alarm_at", now).catch(() => {});
  const token = e?.code === "token";
  await tg(env, "sendMessage", {chat_id: env.OWNER_ID, text: token
    ? "Светокот: токен Яндекса истёк. Получите новый (scopes iot:view и iot:control), положите в ~/.config/yandex-iot-token и выполните:\ncd ~/yandex-lamps/worker && npx wrangler secret put YANDEX_TOKEN < ~/.config/yandex-iot-token"
    : `Светокот: ошибка в ${where}: ${String(e?.message || e).slice(0, 300)}\nСледующее сообщение об ошибке — не раньше чем через час.`});
}
