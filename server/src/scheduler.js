import { db, toTask } from './db.js';
import { sendToUser } from './push.js';
import { startBy, reason } from '../../shared/priority.js';

/**
 * Alert loop: the reason the app can "ring even if you don't open it".
 * Every few seconds, find open tasks whose start-by time has passed and that were
 * not alerted yet (or whose snooze ended), and push a notification to the student's phone.
 * Any change to deadline / progress / estimate clears alerted_at, so the alert time moves with it.
 */
export function checkAlerts(now = Date.now()) {
  const rows = db
    .prepare(`SELECT * FROM tasks WHERE done = 0 AND alerted_at IS NULL AND deadline > ?`)
    .all(new Date(now).toISOString());

  const due = [];
  for (const r of rows) {
    const t = toTask(r);
    if (t.snoozedUntil && new Date(t.snoozedUntil).getTime() > now) continue;
    if (startBy(t).getTime() <= now) due.push({ userId: r.user_id, task: t });
  }

  const mark = db.prepare('UPDATE tasks SET alerted_at = ?, snoozed_until = NULL WHERE id = ?');
  for (const { userId, task } of due) {
    mark.run(new Date(now).toISOString(), task.id);
    sendToUser(userId, {
      type: 'start-by',
      taskId: task.id,
      userId,
      title: `Time to start: ${task.title} · ${task.course}`,
      body: `${reason(task, now)}. Start now so you do not run out of time.`,
    }).catch((e) => console.warn('[alerts]', e.message));
  }
  return due.length;
}

export function startScheduler(seconds) {
  checkAlerts();
  return setInterval(checkAlerts, seconds * 1000);
}
