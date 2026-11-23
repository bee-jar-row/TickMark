import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { PORT, ALERT_CHECK_SECONDS, DB_FILE } from './config.js';

const app = createApp();
app.listen(PORT, () => {
  console.log(`TickMark API on http://localhost:${PORT}  (db: ${DB_FILE})`);
  startScheduler(ALERT_CHECK_SECONDS);
  console.log(`Alert scheduler checks every ${ALERT_CHECK_SECONDS}s`);
});
