import webpush from 'web-push';
import { db, kvGet, kvSet } from './db.js';
import { VAPID_SUBJECT } from './config.js';

// VAPID keys: use .env if given, otherwise generate once and keep them in the database,
// so subscriptions keep working after a restart.
let keys =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
    : kvGet('vapid');
if (!keys) {
  keys = webpush.generateVAPIDKeys();
  kvSet('vapid', keys);
  console.log('[push] generated new VAPID keys (stored in the database)');
}
webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);

export const publicKey = keys.publicKey;

export function saveSubscription(userId, sub) {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, keys) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys`,
  ).run(sub.endpoint, userId, JSON.stringify(sub.keys));
}

export function removeSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

/** Send to every device the user subscribed. Returns how many deliveries succeeded. */
export async function sendToUser(userId, payload) {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  let ok = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: JSON.parse(s.keys) },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: 'high' },
        );
        ok++;
      } catch (err) {
        // 404/410 = the browser dropped the subscription; clean it up.
        if (err.statusCode === 404 || err.statusCode === 410) removeSubscription(s.endpoint);
        else console.warn('[push] send failed:', err.statusCode || err.message);
      }
    }),
  );
  return ok;
}
