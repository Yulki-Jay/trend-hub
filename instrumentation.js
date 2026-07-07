module.exports.register = async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = require('./lib/scheduler');
    startScheduler();
  }
};
