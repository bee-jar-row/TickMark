import { reactive, computed } from 'vue';
import { api } from './api.js';
import { rank, startBy, reason, fmtDate } from '@shared/priority.js';
import { ring } from './alerts.js';

export const state = reactive({
  ready: false,
  error: '',
  tasks: [],
  manualOrder: [],
  settings: { sound: true, vibrate: true, silent: false, hc: false, big: false },
  view: { name: 'list', id: null },
  sheet: null,          // { type: 'add'|'edit'|'deadline'|'progress'|'estimate'|'settings', taskId }
  alert: null,          // { task, test }
  toast: null,          // { msg, undo }
  now: Date.now(),
  history: [],          // undo stack: [{ label, revert: async fn }]
  push: 'off',
});

export const ranked = computed(() => rank(state.tasks, state.manualOrder, state.now));
export const doneTasks = computed(() => state.tasks.filter((t) => t.done));
export const byId = (id) => state.tasks.find((t) => t.id === id);

// ---------- helpers ----------
let toastTimer;
export function toast(msg, undo = true) {
  state.toast = { msg, undo: undo && state.history.length > 0 };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (state.toast = null), 5000);
}
function fail(e) {
  state.error = e.message || String(e);
  setTimeout(() => (state.error = ''), 6000);
}
function pushHistory(label, revert) {
  state.history.push({ label, revert });
  if (state.history.length > 30) state.history.shift();
}
function upsertLocal(t) {
  const i = state.tasks.findIndex((x) => x.id === t.id);
  if (i < 0) state.tasks.push(t); else state.tasks[i] = t;
}
const plain = (t) => JSON.parse(JSON.stringify(t));

export function go(name, id = null) {
  state.view = { name, id };
  if (name === 'detail' && id) history.replaceState(null, '', `#task-${id}`);
  else history.replaceState(null, '', location.pathname);
  requestAnimationFrame(() => document.getElementById('main')?.focus());
}
export const openSheet = (type, taskId = null) => (state.sheet = { type, taskId });
export const closeSheet = () => (state.sheet = null);

// ---------- load ----------
export async function init() {
  try {
    const [me, tasks] = await Promise.all([api.me(), api.tasks()]);
    state.settings = me.settings;
    state.manualOrder = me.manualOrder;
    state.tasks = tasks;
    let seeded = false;
    try { seeded = localStorage.getItem('tickmark.seeded') === '1'; } catch { /* ignore */ }
    if (!tasks.length && !seeded) {
      state.tasks = await api.demo();
      try { localStorage.setItem('tickmark.seeded', '1'); } catch { /* ignore */ }
    }
    const m = location.hash.match(/^#task-(.+)$/);
    if (m && byId(m[1])) state.view = { name: 'detail', id: m[1] };
  } catch (e) {
    state.error = 'Cannot reach the TickMark server. Is it running? (' + e.message + ')';
  } finally {
    state.ready = true;
  }
}

export async function refresh() {
  try { state.tasks = await api.tasks(); } catch { /* keep what we have */ }
}

// ---------- task actions (every one can be undone) ----------
export async function updateTask(id, patch, label, message) {
  const before = plain(byId(id));
  try {
    const after = await api.patch(id, patch);
    upsertLocal(after);
    pushHistory(label, async () => upsertLocal(await api.replace(before)));
    if (message) toast(typeof message === 'function' ? message(after) : message);
    return after;
  } catch (e) { fail(e); }
}

export async function addTask(data) {
  try {
    const t = await api.create(data);
    upsertLocal(t);
    pushHistory('add', async () => {
      await api.remove(t.id);
      state.tasks = state.tasks.filter((x) => x.id !== t.id);
    });
    toast('Added to your list');
    return t;
  } catch (e) { fail(e); }
}

export async function deleteTask(id) {
  const before = plain(byId(id));
  try {
    await api.remove(id);
    state.tasks = state.tasks.filter((x) => x.id !== id);
    pushHistory('delete', async () => upsertLocal(await api.replace(before)));
    go('list');
    toast('Task deleted');
  } catch (e) { fail(e); }
}

export async function setDone(id, done) {
  const t = await updateTask(id, { done }, done ? 'mark done' : 'reopen');
  if (!t) return;
  if (done) { go('list'); toast(`“${t.title}” marked done`); }
  else toast('Back on the list');
}

export async function undo() {
  const h = state.history.pop();
  if (!h) return;
  try {
    await h.revert();
    toast('Undone: ' + h.label, false);
    announce('Undone: ' + h.label);
  } catch (e) { fail(e); }
}

// ---------- order (human-in-the-loop override) ----------
export async function move(id, dir) {
  const ids = ranked.value.map((r) => r.task.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  const before = [...state.manualOrder];
  [ids[i], ids[j]] = [ids[j], ids[i]];
  state.manualOrder = ids;
  pushHistory('order change', async () => { state.manualOrder = before; await api.saveOrder(before); });
  announce(`Moved to rank ${j + 1}`);
  try { await api.saveOrder(ids); } catch (e) { fail(e); }
}

export async function resetOrder() {
  const before = [...state.manualOrder];
  state.manualOrder = [];
  pushHistory('your order', async () => { state.manualOrder = before; await api.saveOrder(before); });
  toast('Back to app order');
  try { await api.saveOrder([]); } catch (e) { fail(e); }
}

export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  try { state.settings = await api.saveSettings(state.settings); } catch (e) { fail(e); }
}

export async function resetDemo() {
  try {
    state.tasks = await api.demo();
    state.manualOrder = [];
    state.history = [];
    go('list');
    toast('Demo data back', false);
  } catch (e) { fail(e); }
}

export async function restoreBackup(data) {
  try {
    const res = await api.importBackup(data);
    state.tasks = res.tasks;
    state.settings = res.settings;
    state.manualOrder = res.manualOrder;
    state.history = [];
    try { localStorage.setItem('tickmark.seeded', '1'); } catch { /* ignore */ }
    go('list');
    toast(`Restored ${res.tasks.length} task${res.tasks.length === 1 ? '' : 's'}`, false);
    return true;
  } catch (e) {
    fail(e);
    return false;
  }
}

export async function snooze(id) {
  try {
    upsertLocal(await api.snooze(id, 30));
    alerted.delete(alertKey(byId(id)));
    toast('Will ring again in 30 min', false);
  } catch (e) { fail(e); }
}

// ---------- in-app alert (foreground) ----------
// The server pushes alerts in the background; while the app is open we also check locally,
// so it rings even if push is off. Each task/start-by pair alerts once.
const alerted = new Set();
const alertKey = (t) => (t ? `${t.id}|${startBy(t).getTime()}` : '');

export function showAlert(task, test = false) {
  if (!task) return;
  alerted.add(alertKey(task));
  state.alert = { task, test };
  ring(state.settings);
  announce(`Alert. ${task.title}, ${task.course}: ${reason(task, state.now)}`);
}

export function checkForeground() {
  state.now = Date.now();
  for (const t of state.tasks) {
    if (t.done || alerted.has(alertKey(t))) continue;
    if (t.snoozedUntil && new Date(t.snoozedUntil).getTime() > state.now) continue;
    const sb = startBy(t).getTime();
    if (sb <= state.now && new Date(t.deadline).getTime() > state.now) {
      // Only ring for start-by times that passed while we were watching, or that the server
      // has not alerted yet. Old ones the student already saw just stay at the top.
      if (!t.alertedAt || Date.now() - new Date(t.alertedAt).getTime() < 60e3) { showAlert(t); break; }
      alerted.add(alertKey(t));
    }
  }
}

export function onPushMessage(payload) {
  if (payload?.taskId) {
    refresh().then(() => {
      const t = byId(payload.taskId);
      if (t && !alerted.has(alertKey(t))) showAlert(t);
    });
  }
}

// ---------- screen reader announcements ----------
export const live = reactive({ text: '' });
export function announce(text) {
  live.text = '';
  setTimeout(() => (live.text = text), 50);
}

export { reason, startBy, fmtDate };
