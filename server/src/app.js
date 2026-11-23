import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, toTask, ensureUser, DEFAULT_SETTINGS } from './db.js';
import { publicKey, saveSubscription, removeSubscription, sendToUser } from './push.js';
import { CLIENT_DIST, CORS_ORIGIN } from './config.js';
import { HOUR } from '../../shared/priority.js';

// ---------- validation ----------
const DIFFS = ['easy', 'medium', 'hard'];
class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

function clean(body, { partial }) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  const need = (k) => { if (!partial && !has(k)) throw new HttpError(400, `${k} is required`); return has(k); };

  if (need('title')) {
    const v = String(body.title).trim();
    if (!v || v.length > 120) throw new HttpError(400, 'title must be 1–120 characters');
    out.title = v;
  }
  if (need('course')) {
    const v = String(body.course).trim();
    if (!v || v.length > 120) throw new HttpError(400, 'course must be 1–120 characters');
    out.course = v;
  }
  if (need('deadline')) {
    const d = new Date(body.deadline);
    if (isNaN(d)) throw new HttpError(400, 'deadline must be a date');
    out.deadline = d.toISOString();
  }
  if (need('weight')) {
    const w = Number(body.weight);
    if (!Number.isFinite(w) || w < 0 || w > 100) throw new HttpError(400, 'weight must be 0–100');
    out.weight = w;
  }
  if (has('difficulty') || !partial) {
    const v = body.difficulty ?? 'medium';
    if (!DIFFS.includes(v)) throw new HttpError(400, 'difficulty must be easy, medium or hard');
    out.difficulty = v;
  }
  if (has('hours')) {
    if (body.hours === null || body.hours === '') out.hours = null;
    else {
      const h = Number(body.hours);
      if (!Number.isFinite(h) || h <= 0 || h > 500) throw new HttpError(400, 'hours must be 0–500');
      out.hours = h;
    }
  }
  if (has('progress')) {
    const p = Math.round(Number(body.progress));
    if (!Number.isFinite(p) || p < 0 || p > 100) throw new HttpError(400, 'progress must be 0–100');
    out.progress = p;
  }
  if (has('done')) out.done = body.done ? 1 : 0;
  return out;
}

// Changing any input of the prediction moves the alert time, so the alert must be re-armed.
const RE_ARM = ['deadline', 'progress', 'hours', 'difficulty', 'done'];

function demoTasks() {
  const now = Date.now();
  const at = (h) => new Date(now + h * HOUR).toISOString();
  return [
    { title: 'Essay 2', course: 'Data Structures', deadline: at(18), weight: 15, difficulty: 'hard', progress: 0 },
    { title: 'Lab 5', course: 'Electronics', deadline: at(48), weight: 10, difficulty: 'medium', progress: 50 },
    { title: 'Quiz 3', course: 'Calculus', deadline: at(80), weight: 5, difficulty: 'easy', progress: 0 },
  ];
}

// ---------- app ----------
export function createApp() {
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.get('/api/push/key', (_req, res) => res.json({ publicKey }));

  // Every request below belongs to one student, identified by an anonymous device id.
  const api = express.Router();
  api.use((req, _res, next) => {
    const id = req.get('x-user-id');
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) return next(new HttpError(401, 'missing or bad X-User-Id header'));
    req.user = ensureUser(id);
    next();
  });

  api.get('/me', (req, res) => {
    res.json({
      id: req.user.id,
      settings: { ...DEFAULT_SETTINGS, ...JSON.parse(req.user.settings) },
      manualOrder: JSON.parse(req.user.manual_order),
    });
  });

  api.put('/me/settings', (req, res) => {
    const s = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in req.body) s[k] = !!req.body[k];
    db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(s), req.user.id);
    res.json(s);
  });

  api.put('/me/order', (req, res) => {
    const order = Array.isArray(req.body.order) ? req.body.order.filter((x) => typeof x === 'string').slice(0, 500) : [];
    db.prepare('UPDATE users SET manual_order = ? WHERE id = ?').run(JSON.stringify(order), req.user.id);
    res.json({ manualOrder: order });
  });

  api.get('/tasks', (req, res) => {
    const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY deadline').all(req.user.id);
    res.json(rows.map(toTask));
  });

  const getOwn = (req) => {
    const r = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!r) throw new HttpError(404, 'task not found');
    return r;
  };

  const insert = (userId, id, t) => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, title, course, deadline, weight, difficulty, hours, progress, done)
       VALUES (@id, @user_id, @title, @course, @deadline, @weight, @difficulty, @hours, @progress, @done)`,
    ).run({ hours: null, progress: 0, done: 0, ...t, id, user_id: userId });
    return toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  };

  api.post('/tasks', (req, res) => {
    const t = clean(req.body, { partial: false });
    res.status(201).json(insert(req.user.id, crypto.randomUUID(), t));
  });

  // Full replace / restore — used by Undo (also brings back a deleted task with the same id).
  api.put('/tasks/:id', (req, res) => {
    if (!/^[A-Za-z0-9-]{8,64}$/.test(req.params.id)) throw new HttpError(400, 'bad id');
    const t = clean(req.body, { partial: false });
    const existing = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(req.params.id);
    if (existing && existing.user_id !== req.user.id) throw new HttpError(404, 'task not found');
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json(insert(req.user.id, req.params.id, t));
  });

  api.patch('/tasks/:id', (req, res) => {
    const row = getOwn(req);
    const t = clean(req.body, { partial: true });
    const keys = Object.keys(t);
    if (!keys.length) return res.json(toTask(row));
    const rearm = keys.some((k) => RE_ARM.includes(k));
    const sets = keys.map((k) => `${k} = @${k}`);
    if (rearm) sets.push('alerted_at = NULL', 'snoozed_until = NULL');
    sets.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = @id`).run({ ...t, id: row.id });
    res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.id)));
  });

  api.delete('/tasks/:id', (req, res) => {
    const row = getOwn(req);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(row.id);
    res.json(toTask(row));
  });

  api.post('/tasks/:id/snooze', (req, res) => {
    const row = getOwn(req);
    const minutes = Math.min(24 * 60, Math.max(5, Number(req.body.minutes) || 30));
    const until = new Date(Date.now() + minutes * 60e3).toISOString();
    db.prepare('UPDATE tasks SET alerted_at = NULL, snoozed_until = ? WHERE id = ?').run(until, row.id);
    res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.id)));
  });

  api.post('/demo', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE user_id = ?').run(req.user.id);
    db.prepare(`UPDATE users SET manual_order = '[]' WHERE id = ?`).run(req.user.id);
    const tasks = demoTasks().map((t) => insert(req.user.id, crypto.randomUUID(), t));
    res.json(tasks);
  });

  api.post('/push/subscribe', (req, res) => {
    const sub = req.body;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new HttpError(400, 'bad subscription');
    saveSubscription(req.user.id, sub);
    res.status(201).json({ ok: true });
  });

  api.delete('/push/subscribe', (req, res) => {
    if (req.body?.endpoint) removeSubscription(req.body.endpoint);
    res.json({ ok: true });
  });

  api.post('/push/test', async (req, res) => {
    const sent = await sendToUser(req.user.id, {
      type: 'test',
      userId: req.user.id,
      title: 'TickMark test alert',
      body: 'This is how a start-by alert looks and feels.',
    });
    res.json({ sent });
  });

  app.use('/api', api);

  // Production: serve the built Vue app from the same server.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'server error' : err.message });
  });
  return app;
}
