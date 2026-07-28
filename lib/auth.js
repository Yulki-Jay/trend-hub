const { getCurrentUser } = require('./user-auth');

function checkAuth() {
  return getCurrentUser()?.role === 'admin';
}

module.exports = { checkAuth };
