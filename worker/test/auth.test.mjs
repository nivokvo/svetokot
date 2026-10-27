import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {checkInitData, webhookSecret} from "../src/auth.js";
import {actionsFor, parseLamp} from "../src/yandex.js";

const TOKEN = "123456:TEST-token";
// initData так, как его подписывает Telegram: ключ = HMAC("WebAppData", токен), подпись = HMAC(ключ, отсортированные пары)
function sign(fields, token = TOKEN) {
  const dcs = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  return new URLSearchParams({...fields, hash: createHmac("sha256", key).update(dcs).digest("hex")}).toString();
}
const now = 1793131000e3, user = JSON.stringify({id: 981748795, first_name: "Владелец"});

test("настоящий initData принимается", async () => {
  const u = await checkInitData(sign({auth_date: String(now / 1e3 - 60), user, query_id: "AAE"}), TOKEN, now);
  assert.equal(u.id, 981748795);
});

test("подделанный, чужой и устаревший initData отклоняются", async () => {
  const good = sign({auth_date: String(now / 1e3 - 60), user});
  assert.equal(await checkInitData(good.replace("981748795", "1"), TOKEN, now), null);
  assert.equal(await checkInitData(sign({auth_date: String(now / 1e3), user}, "999:other"), TOKEN, now), null);
  assert.equal(await checkInitData(sign({auth_date: String(now / 1e3 - 90000), user}), TOKEN, now), null);
  assert.equal(await checkInitData("", TOKEN, now), null);
  assert.equal(await checkInitData(good, undefined, now), null);
});

test("секрет вебхука стабилен и подходит Telegram", async () => {
  const a = await webhookSecret({BOT_TOKEN: TOKEN}), b = await webhookSecret({BOT_TOKEN: TOKEN});
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, await webhookSecret({BOT_TOKEN: "other"}));
});

test("команды Яндекса", () => {
  assert.deepEqual(actionsFor({kind: "off"}), [{type: "devices.capabilities.on_off", state: {instance: "on", value: false}}]);
  const t = actionsFor({kind: "temp", value: {k: 12000, b: 0}});
  assert.equal(t[1].state.value, 9000);              // температура зажата в 1500–9000
  assert.equal(t.length, 2);                         // яркость 0 не отправляем
  const c = actionsFor({kind: "hsv", value: {h: 400, s: 50, b: 30}});
  assert.deepEqual(c[1].state.value, {h: 360, s: 50, v: 100});
  assert.equal(c[2].state.value, 30);
  assert.equal(actionsFor({kind: "night"})[1].state.value, "candle");
  assert.throws(() => actionsFor({kind: "scene", value: "disco"}));
  assert.throws(() => actionsFor({kind: "rm -rf"}));
});

test("разбор состояния лампы", () => {
  const dev = {capabilities: [
    {type: "devices.capabilities.on_off", state: {instance: "on", value: true}},
    {type: "devices.capabilities.range", state: {instance: "brightness", value: 1}},
    {type: "devices.capabilities.color_setting", state: {instance: "scene", value: "candle"}}]};
  assert.deepEqual(parseLamp(dev), {online: true, on: true, bright: 1, mode: "scene", temp: 4000, scene: "candle"});
  assert.deepEqual(parseLamp(undefined), {online: false});
});
