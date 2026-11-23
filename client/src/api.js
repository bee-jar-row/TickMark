// Thin wrapper around the TickMark REST API.
// Each phone/browser gets an anonymous id (no login needed for the prototype).

const KEY = 'tickmark.userId';
function makeId() {
  return (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9-]/g, '');
}
export const userId = (() => {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = makeId(); localStorage.setItem(KEY, id); }
    return id;
  } catch { return makeId(); }
})();

const BASE = import.meta.env.VITE_API_URL || '';

async function request(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-user-id': userId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  me: () => request('GET', '/me'),
  saveSettings: (s) => request('PUT', '/me/settings', s),
  saveOrder: (order) => request('PUT', '/me/order', { order }),
  tasks: () => request('GET', '/tasks'),
  create: (t) => request('POST', '/tasks', t),
  replace: (t) => request('PUT', `/tasks/${t.id}`, t),
  patch: (id, p) => request('PATCH', `/tasks/${id}`, p),
  remove: (id) => request('DELETE', `/tasks/${id}`),
  snooze: (id, minutes = 30) => request('POST', `/tasks/${id}/snooze`, { minutes }),
  demo: () => request('POST', '/demo'),
  pushKey: () => request('GET', '/push/key'),
  subscribe: (sub) => request('POST', '/push/subscribe', sub),
  testPush: () => request('POST', '/push/test'),
};
