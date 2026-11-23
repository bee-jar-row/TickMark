// Two alert channels: (1) the screen, (2) sound + vibration.
// Background delivery (phone in pocket, app closed) goes through Web Push + the service worker.
import { api } from './api.js';

let audioCtx = null;

export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch { /* no audio on this device */ }
  return !!audioCtx;
}
export const audioReady = () => !!audioCtx;

export function ring(settings) {
  if (settings.vibrate || settings.silent) {
    try { navigator.vibrate?.([500, 150, 200, 150, 500]); } catch { /* iOS has no vibrate API */ }
  }
  if (!settings.sound || settings.silent || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    [0, 0.35, 0.7].forEach((off, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = i === 1 ? 660 : 880;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.28);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.3);
    });
  } catch { /* ignore */ }
}

// ---------- Web Push ----------
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js'); } catch { return null; }
}

function b64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Returns 'on' | 'denied' | 'unsupported' | 'error:<msg>' */
export async function enablePush() {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
    await navigator.serviceWorker.ready;
    const { publicKey } = await api.pushKey();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
    await api.subscribe(sub.toJSON());
    return 'on';
  } catch (e) {
    return 'error:' + e.message;
  }
}

export async function pushStatus() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch { return 'off'; }
}
