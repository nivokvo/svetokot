// Чистые функции времени: восход и закат, кривая циркадного, рассвет под будильник, таймер засыпания.
// Без обращений к сети и базе, чтобы их можно было проверить через `node --test`.

export const TZ_MIN = 180;            // Europe/Minsk — всегда UTC+3, перехода на летнее время нет
const DAY = 864e5, MIN = 6e4;
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

// Календарная дата и минуты от полуночи по Минску для момента ms.
export function minsk(ms) {
  const d = new Date(ms + TZ_MIN * MIN);
  return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7,  // 0 = понедельник
          min: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60};
}
// Момент (ms) для даты y-m-d и minutes минут от полуночи по Минску.
export const minskMs = (y, m, d, minutes = 0) => Date.UTC(y, m - 1, d) + (minutes - TZ_MIN) * MIN;
export const dateKey = ms => { const p = minsk(ms); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };

// Восход и закат по формулам NOAA (General Solar Position Calculations), точность около минуты.
// Возвращает минуты от полуночи по Минску; для полярного дня или ночи — null.
export function sunTimes(y, m, d, lat, lon) {
  const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / DAY);
  const g = 2 * Math.PI / ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365) * (doy - 1);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null;
  const ha = deg(Math.acos(cosH));
  return {rise: 720 - 4 * (lon + ha) - eqtime + TZ_MIN, set: 720 - 4 * (lon - ha) - eqtime + TZ_MIN};
}

// Температура циркадного (K) в момент t минут от полуночи: ночью night, днём day,
// утром плавный косинусный подъём от восхода, вечером такой же спуск, который заканчивается на закате.
export function circadianK(t, sun, c) {
  const span = Math.max(0, sun.set - sun.rise);
  const tr = Math.max(1, Math.min(c.transition, span / 2));
  const ramp = (x, from, to) => from + (to - from) * (1 - Math.cos(Math.PI * x)) / 2;
  if (t < sun.rise || t >= sun.set) return c.night;
  if (t < sun.rise + tr) return ramp((t - sun.rise) / tr, c.night, c.day);
  if (t >= sun.set - tr) return ramp((t - sun.set + tr) / tr, c.day, c.night);
  return c.day;
}

// Точки кривой на сутки (для графика в Mini App), шаг в минутах.
export const curve = (sun, c, step = 10) => Array.from({length: 1440 / step + 1}, (_, i) => [i * step, Math.round(circadianK(i * step, sun, c))]);

// Ближайший восход строго после now (ms): до него длится пауза циркадного после ручной настройки.
export function nextSunrise(now, lat, lon) {
  for (let k = 0; k < 3; k++) {
    const p = minsk(now + k * DAY), s = sunTimes(p.y, p.m, p.d, lat, lon);
    if (!s) continue;
    const at = minskMs(p.y, p.m, p.d, s.rise);
    if (at > now) return at;
  }
  return now + DAY;
}

// Конец утреннего перехода сегодня (ms): после рассвета циркадный ждёт до этого момента,
// чтобы не вернуть тёплый ночной свет сразу после будильника.
export function morningEnd(now, lat, lon, c) {
  const p = minsk(now), s = sunTimes(p.y, p.m, p.d, lat, lon);
  if (!s) return now;
  return minskMs(p.y, p.m, p.d, s.rise + Math.min(c.transition, (s.set - s.rise) / 2));
}

// Рассвет под будильник. alarm = {time: "07:30", days: битовая маска (бит 0 = пн … бит 6 = вс), minutes, enabled}.
// Возвращает {at, p} — момент будильника и прогресс 0…1, если сейчас идёт рассвет (включая минуту самого будильника), иначе null.
export function dawnAt(alarm, now) {
  if (!alarm.enabled) return null;
  const [hh, mm] = alarm.time.split(":").map(Number);
  const len = Math.max(1, alarm.minutes) * MIN;
  for (const k of [0, 1]) {               // будильник в 00:10 начинает рассвет ещё вчера
    const p = minsk(now + k * DAY);
    if (!(alarm.days >> p.wd & 1)) continue;
    const at = minskMs(p.y, p.m, p.d, hh * 60 + mm);
    if (now >= at - len && now < at + MIN) return {at, p: Math.min(1, (now - at + len) / len)};
  }
  return null;
}

// Значения рассвета для прогресса p: от тёплого тусклого к дневному.
export const dawnLevel = (p, from = {k: 2700, b: 1}, to = {k: 5500, b: 100}) =>
  ({k: Math.round(from.k + (to.k - from.k) * p), b: Math.max(1, Math.round(from.b + (to.b - from.b) * p))});

// Ближайший будильник после now (ms) или null — для подписи в Mini App.
export function nextAlarm(alarm, now) {
  if (!alarm.enabled || !alarm.days) return null;
  const [hh, mm] = alarm.time.split(":").map(Number);
  for (let k = 0; k < 8; k++) {
    const p = minsk(now + k * DAY);
    if (!(alarm.days >> p.wd & 1)) continue;
    const at = minskMs(p.y, p.m, p.d, hh * 60 + mm);
    if (at > now) return at;
  }
  return null;
}

// Таймер засыпания. timer = {start, end, from} (ms и исходная яркость).
// Последняя треть (не больше 5 минут) — «Ночник», до этого яркость плавно опускается до 1%, в конце — выключение.
export function timerStep(timer, now) {
  const total = timer.end - timer.start;
  const night = Math.min(5 * MIN, total / 3), dimEnd = timer.end - night;
  if (now >= timer.end) return {action: "off"};
  if (now >= dimEnd) return {action: "night"};
  const p = Math.max(0, (now - timer.start) / (dimEnd - timer.start));
  return {action: "dim", bright: Math.max(1, Math.round(timer.from + (1 - timer.from) * p))};
}
