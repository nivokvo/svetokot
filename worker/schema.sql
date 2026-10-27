-- Светокот: настройки и состояние в D1. Применить: npx wrangler d1 execute lamps-bot --remote --file schema.sql
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,   -- settings, circ (пауза и отправленные температуры), timer, presets, dawn_skip, setup, alarm_at, pending:<id>
  value TEXT NOT NULL     -- JSON
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, -- Telegram id; владелец задан в wrangler.toml (OWNER_ID) и в таблицу не попадает
  name TEXT,
  added INTEGER
);
CREATE TABLE IF NOT EXISTS alarms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL,          -- "07:30" по Минску
  days INTEGER NOT NULL,       -- бит 0 = пн … бит 6 = вс
  minutes INTEGER NOT NULL DEFAULT 30,  -- длительность рассвета
  enabled INTEGER NOT NULL DEFAULT 1,
  lamps TEXT NOT NULL DEFAULT '[0,1]'   -- номера ламп: 0 = «Лампа 1», 1 = «Лампа 2»
);
