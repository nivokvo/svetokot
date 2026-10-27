// Проверки Telegram: подпись initData из Mini App и секрет вебхука.

// Проверка подписи данных пользователя из Mini App (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
export async function checkInitData(initData, token, now = Date.now()) {
  if (!initData || !token) return null;
  const p = new URLSearchParams(initData), hash = p.get("hash");
  p.delete("hash");
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(enc.encode("WebAppData"), token);
  const sig = hex(await hmac(secret, dcs));
  if (sig !== hash) return null;
  if (now / 1000 - Number(p.get("auth_date")) > 86400) return null;
  return JSON.parse(p.get("user") || "null");
}
const enc = new TextEncoder();
const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join("");
const hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign("HMAC",
  await crypto.subtle.importKey("raw", key, {name: "HMAC", hash: "SHA-256"}, false, ["sign"]), enc.encode(data)));
// Секрет вебхука выводим из токена бота: отдельный секрет заводить не нужно, а снаружи его не угадать.
export const webhookSecret = async env => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("lamps-webhook:" + env.BOT_TOKEN)))).slice(0, 48);
