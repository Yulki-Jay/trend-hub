const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trendhub-auth-test-'));
process.env.TRENDHUB_DATA_DIR = testDataDir;

const db = require('../lib/db');
const {
  authenticateUser,
  createSession,
  createUser,
  deleteDisabledUser,
  ensureDefaultAdmin,
  updateUserAccount,
} = require('../lib/user-auth');
const {
  consumeRateLimit,
  fetchPublicText,
  sanitizePublicHttpUrl,
  validateExternalUrl,
  validatePassword,
} = require('../lib/security');

test.after(() => {
  db.close();
  fs.rmSync(testDataDir, { recursive: true, force: true });
});

test('password policy rejects weak and identity-derived passwords', () => {
  assert.throws(() => validatePassword('short'), /12/);
  assert.throws(() => validatePassword('Alice-very-long-password', { username: 'alice' }), /不能包含/);
  assert.equal(validatePassword('correct horse battery staple!'), 'correct horse battery staple!');
});

test('external source URLs reject local and non-http targets', () => {
  assert.throws(() => validateExternalUrl('file:///etc/passwd'), /HTTP/);
  assert.throws(() => validateExternalUrl('http://127.0.0.1:3000/feed'), /内网/);
  assert.throws(() => validateExternalUrl('http://192.168.1.10/feed'), /内网/);
  assert.equal(validateExternalUrl('https://example.com/feed'), 'https://example.com/feed');
  assert.equal(sanitizePublicHttpUrl('javascript:alert(1)'), null);
  assert.equal(sanitizePublicHttpUrl('/story', 'https://example.com/feed'), 'https://example.com/story');
});

test('RSS fetch protection rejects literal loopback targets before requesting them', async () => {
  await assert.rejects(() => fetchPublicText('http://127.0.0.1:9999/feed'), /内网/);
});

test('user authentication and identity changes require the current password', () => {
  const user = createUser({
    username: 'product_user',
    email: 'product@example.com',
    displayName: 'Product User',
    password: 'correct horse battery staple!',
  });
  assert.equal(authenticateUser('PRODUCT_USER', 'correct horse battery staple!').id, user.id);
  assert.equal(authenticateUser('product_user', 'wrong-password'), null);
  assert.throws(() => updateUserAccount(user.id, {
    username: 'renamed_user', email: user.email, display_name: user.display_name,
  }), /当前密码/);
  const updated = updateUserAccount(user.id, {
    username: 'renamed_user', email: user.email, display_name: user.display_name,
    current_password: 'correct horse battery staple!',
  });
  assert.equal(updated.username, 'renamed_user');
});

test('temporary admin credentials require a password change', () => {
  const admin = ensureDefaultAdmin({
    username: 'secure_admin',
    email: 'secure-admin@example.com',
    password: 'temporary bootstrap password!',
    mustChangePassword: true,
  });
  assert.equal(admin.role, 'admin');
  assert.equal(admin.must_change_password, true);
});

test('sessions are capped per user and rate limits eventually block', () => {
  const user = db.prepare("SELECT id FROM users WHERE username='renamed_user'").get();
  for (let i = 0; i < 14; i += 1) createSession(user.id);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM user_sessions WHERE user_id=?').get(user.id).count, 10);

  const policy = { limit: 2, windowSeconds: 60, blockSeconds: 120 };
  assert.equal(consumeRateLimit('test-login', 'subject', policy).allowed, true);
  assert.equal(consumeRateLimit('test-login', 'subject', policy).allowed, true);
  assert.equal(consumeRateLimit('test-login', 'subject', policy).allowed, false);
});

test('permanent user deletion requires disabled status and removes user-owned data', () => {
  const user = createUser({
    username: 'delete_me',
    email: 'delete-me@example.com',
    displayName: 'Delete Me',
    password: 'correct horse battery staple!',
  });
  createSession(user.id);
  db.prepare(`
    INSERT INTO user_favorites(user_id,item_type,item_key,item_data) VALUES(?,?,?,?)
  `).run(user.id, 'repo', 'owner/repo', '{}');
  db.prepare(`
    INSERT INTO user_dismissals(user_id,item_type,item_key) VALUES(?,?,?)
  `).run(user.id, 'repo', 'owner/hidden');

  assert.throws(() => deleteDisabledUser(user.id), /先停用/);
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(user.id);
  const deleted = deleteDisabledUser(user.id);

  assert.equal(deleted.username, 'delete_me');
  assert.equal(db.prepare('SELECT COUNT(*) count FROM users WHERE id=?').get(user.id).count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM user_sessions WHERE user_id=?').get(user.id).count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM user_favorites WHERE user_id=?').get(user.id).count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM user_dismissals WHERE user_id=?').get(user.id).count, 0);
});
