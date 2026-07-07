const db = require('./db');

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : fallback;
}

function getSettings() {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  ).run(key, String(value ?? ''));
}

function setSettings(obj) {
  const tx = db.transaction((o) => {
    for (const [k, v] of Object.entries(o)) setSetting(k, v);
  });
  tx(obj);
}

module.exports = { getSetting, getSettings, setSetting, setSettings };
