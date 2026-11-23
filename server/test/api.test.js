import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tickmark-test-'));
process.env.DATA_DIR = tmp;

let server, base, checkAlerts, db;
const H = { 'content-type': 'application/json', 'x-user-id': 'test-user-0001' };
const call = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: H, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};

before(async () => {
  const { createApp } = await import('../src/app.js');
  ({ checkAlerts } = await import('../src/scheduler.js'));
  ({ db } = await import('../src/db.js'));
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(() => { server.close(); db.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('requires a user id', async () => {
  const r = await fetch(base + '/tasks');
  assert.equal(r.status, 401);
});

test('create, update, undo-restore and delete a task', async () => {
  const deadline = new Date(Date.now() + 30 * 3600e3).toISOString();
  const c = await call('POST', '/tasks', { title: 'Essay 2', course: 'DS', deadline, weight: 15, difficulty: 'hard' });
  assert.equal(c.status, 201);
  const id = c.body.id;

  const p = await call('PATCH', `/tasks/${id}`, { progress: 50 });
  assert.equal(p.body.progress, 50);

  const bad = await call('PATCH', `/tasks/${id}`, { progress: 150 });
  assert.equal(bad.status, 400);

  const d = await call('DELETE', `/tasks/${id}`);
  const restored = await call('PUT', `/tasks/${id}`, { ...d.body, progress: 0 });
  assert.equal(restored.body.id, id);

  const list = await call('GET', '/tasks');
  assert.equal(list.body.length, 1);
});

test('scheduler alerts once when start-by passes, and re-arms after an edit', async () => {
  const deadline = new Date(Date.now() + 2 * 3600e3).toISOString(); // hard = 6 h → start-by already passed
  const { body: t } = await call('POST', '/tasks', { title: 'Lab', course: 'E', deadline, weight: 10, difficulty: 'hard' });
  assert.ok(checkAlerts() >= 1);
  assert.equal(checkAlerts(), 0); // not twice
  await call('PATCH', `/tasks/${t.id}`, { deadline: new Date(Date.now() + 100 * 3600e3).toISOString() });
  const after = await call('GET', '/tasks');
  assert.equal(after.body.find((x) => x.id === t.id).alertedAt, null);
});

test('settings and manual order are saved', async () => {
  await call('PUT', '/me/settings', { silent: true });
  await call('PUT', '/me/order', { order: ['a', 'b'] });
  const me = await call('GET', '/me');
  assert.equal(me.body.settings.silent, true);
  assert.deepEqual(me.body.manualOrder, ['a', 'b']);
});
