const { cookies } = require('next/headers');
const { getSetting } = require('./settings');

const COOKIE = 'th_admin';

function checkAuth() {
  const c = cookies().get(COOKIE);
  return !!c && c.value === adminToken();
}

function adminToken() {
  const pw = getSetting('admin_password', 'admin123');
  return Buffer.from('th:' + pw).toString('base64');
}

module.exports = { checkAuth, adminToken, COOKIE };
