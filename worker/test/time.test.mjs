import {test} from "node:test";
import assert from "node:assert/strict";
import {sunTimes, circadianK, curve, minskMs, minsk, nextSunrise, morningEnd, dawnAt, dawnLevel, nextAlarm, timerStep} from "../src/time.js";

const LAT = 53.90, LON = 27.56, MIN = 6e4;
const C = {night: 2700, day: 5500, transition: 120};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("восход и закат Минска совпадают с внешними таблицами", () => {
  // solarwatch.app / alpenglowapp.com: 15 октября — 07:37 и 18:13
  const oct15 = sunTimes(2026, 10, 15, LAT, LON);
  near(oct15.rise, 7 * 60 + 37, 3, "восход 15.10");
  near(oct15.set, 18 * 60 + 13, 3, "закат 15.10");
  // 27 октября: ≈07:58 и ≈17:49
  const oct27 = sunTimes(2026, 10, 27, LAT, LON);
  near(oct27.rise, 7 * 60 + 58, 3, "восход 27.10");
  near(oct27.set, 17 * 60 + 49, 3, "закат 27.10");
  // самый длинный и самый короткий день
  const jun = sunTimes(2026, 6, 21, LAT, LON), dec = sunTimes(2026, 12, 21, LAT, LON);
  assert.ok(jun.set - jun.rise > 17 * 60 && dec.set - dec.rise < 7.5 * 60);
});

test("кривая циркадного: ночь, переходы, день", () => {
  const sun = {rise: 480, set: 1070};
  assert.equal(circadianK(0, sun, C), 2700);
  assert.equal(circadianK(479, sun, C), 2700);
  assert.equal(circadianK(480, sun, C), 2700);               // начало утреннего перехода
  assert.equal(Math.round(circadianK(540, sun, C)), 4100);   // середина перехода
  assert.equal(circadianK(600, sun, C), 5500);               // конец перехода
  assert.equal(circadianK(800, sun, C), 5500);
  assert.equal(Math.round(circadianK(1010, sun, C)), 4100);  // середина вечернего перехода
  assert.equal(circadianK(1070, sun, C), 2700);              // закат
  assert.equal(circadianK(1439, sun, C), 2700);
  // кривая монотонна на переходах
  const pts = curve(sun, C, 1);
  for (let i = 481; i < 600; i++) assert.ok(pts[i][1] >= pts[i - 1][1]);
  for (let i = 951; i < 1070; i++) assert.ok(pts[i][1] <= pts[i - 1][1]);
  assert.equal(pts.length, 1441);
});

test("короткий день: переходы не перекрываются", () => {
  const sun = {rise: 560, set: 760};     // 200 минут дня, переходы по 100
  assert.equal(circadianK(660, sun, C), 5500);
  assert.ok(circadianK(610, sun, C) < 5500 && circadianK(710, sun, C) < 5500);
});

test("пауза до следующего утреннего перехода", () => {
  const evening = minskMs(2026, 10, 27, 22 * 60);
  const rise = nextSunrise(evening, LAT, LON), p = minsk(rise);
  assert.equal(p.d, 28);
  near(p.min, 8 * 60, 3, "восход 28.10");
  const morning = minskMs(2026, 10, 27, 6 * 60);
  assert.equal(minsk(nextSunrise(morning, LAT, LON)).d, 27);
  const end = minsk(morningEnd(morning, LAT, LON, C));
  near(end.min, 9 * 60 + 58, 3, "конец утреннего перехода");
});

test("рассвет под будильник по дням недели", () => {
  const weekdays = 0b0011111;                        // пн-пт
  const alarm = {time: "07:30", days: weekdays, minutes: 30, enabled: true};
  // 27.10.2026 — вторник
  assert.equal(minsk(minskMs(2026, 10, 27, 0)).wd, 1);
  assert.equal(dawnAt(alarm, minskMs(2026, 10, 27, 6 * 60 + 59)), null);
  assert.equal(dawnAt(alarm, minskMs(2026, 10, 27, 7 * 60)).p, 0);
  assert.equal(dawnAt(alarm, minskMs(2026, 10, 27, 7 * 60 + 15)).p, 0.5);
  assert.equal(dawnAt(alarm, minskMs(2026, 10, 27, 7 * 60 + 30)).p, 1);
  assert.equal(dawnAt(alarm, minskMs(2026, 10, 27, 7 * 60 + 31)), null);
  // 31.10 — суббота: будильник не звонит
  assert.equal(dawnAt(alarm, minskMs(2026, 10, 31, 7 * 60 + 15)), null);
  assert.equal(dawnAt({...alarm, enabled: false}, minskMs(2026, 10, 27, 7 * 60 + 15)), null);
  // будильник в 00:10 по средам начинает рассвет во вторник в 23:40
  const late = {time: "00:10", days: 1 << 2, minutes: 30, enabled: true};
  assert.equal(dawnAt(late, minskMs(2026, 10, 27, 23 * 60 + 55)).p, 0.5);
  // ближайший будильник после пятничного вечера — в понедельник
  const next = minsk(nextAlarm(alarm, minskMs(2026, 10, 30, 20 * 60)));
  assert.deepEqual([next.d, next.wd, next.min], [2, 0, 450]);
  assert.equal(nextAlarm({...alarm, days: 0}, Date.now()), null);
});

test("уровни рассвета", () => {
  assert.deepEqual(dawnLevel(0), {k: 2700, b: 1});
  assert.deepEqual(dawnLevel(1), {k: 5500, b: 100});
  assert.deepEqual(dawnLevel(0.5), {k: 4100, b: 51});
});

test("ступени таймера засыпания", () => {
  const start = 0, t30 = {start, end: 30 * MIN, from: 80};
  assert.deepEqual(timerStep(t30, 0), {action: "dim", bright: 80});
  assert.deepEqual(timerStep(t30, 12.5 * MIN), {action: "dim", bright: 41});   // половина из 25 минут затемнения
  assert.equal(timerStep(t30, 24.9 * MIN).action, "dim");
  assert.equal(timerStep(t30, 25 * MIN).action, "night");                      // последние 5 минут — ночник
  assert.equal(timerStep(t30, 30 * MIN).action, "off");
  const t15 = {start, end: 15 * MIN, from: 100};
  assert.equal(timerStep(t15, 9.9 * MIN).action, "dim");
  assert.equal(timerStep(t15, 10 * MIN).action, "night");
  assert.ok(timerStep(t15, 9.9 * MIN).bright >= 1);
});
