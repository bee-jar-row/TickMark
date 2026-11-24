<script setup>
import { ref } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { state, saveSettings, closeSheet, resetDemo, restoreBackup, showAlert, ranked, toast } from '../store.js';
import { unlockAudio, enablePush } from '../alerts.js';
import { api } from '../api.js';

const fileInput = ref(null);

const ROWS = [
  ['sound', 'Ring sound', 'Plays when a task passes its start-by time'],
  ['vibrate', 'Vibration', 'Long-short-long pattern (Android; iPhone uses its own)'],
  ['silent', 'Quiet class mode', 'Vibration only, no sound'],
  ['hc', 'High contrast', 'Darker text and borders'],
  ['big', 'Bigger text and buttons', ''],
];

const PUSH_TEXT = {
  on: 'On — your phone rings even when TickMark is closed.',
  off: 'Off — alerts only while the app is open.',
  denied: 'Blocked in browser settings.',
  unsupported: 'Not supported in this browser (iPhone: Add to Home Screen first).',
};

async function turnOnPush() {
  unlockAudio();
  state.push = await enablePush();
}

function testHere() {
  unlockAudio();
  closeSheet();
  showAlert(ranked.value[0]?.task || { id: 'test', title: 'Example', course: 'Test', weight: 10, deadline: new Date(Date.now() + 20 * 3600e3).toISOString(), progress: 0, difficulty: 'hard', hours: null }, true);
}

async function testPush() {
  try {
    const { sent } = await api.testPush();
    toast(sent ? 'Test push sent — lock your phone to feel it' : 'No device has push turned on yet', false);
  } catch (e) { toast(e.message, false); }
}

async function exportJson() {
  try {
    const data = await api.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickmark-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded', false);
  } catch (e) { toast(e.message, false); }
}

async function onPickBackup(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (await restoreBackup(data)) closeSheet();
  } catch {
    toast('Invalid backup file', false);
  }
}
</script>

<template>
  <BottomSheet title="Settings">
    <label v-for="[k, label, sub] in ROWS" :key="k" class="setting">
      <span>{{ label }}<small v-if="sub">{{ sub }}</small></span>
      <input type="checkbox" :checked="state.settings[k]" @change="saveSettings({ [k]: $event.target.checked })" />
    </label>

    <div class="lbl" style="margin-top: 16px">Alerts when the app is closed</div>
    <p class="reason">{{ PUSH_TEXT[state.push] || state.push }}</p>
    <button v-if="state.push !== 'on' && state.push !== 'unsupported'" class="btn block" @click="turnOnPush">Turn on background alerts</button>

    <div class="row" style="margin-top: 16px">
      <button class="btn" @click="testHere">Test alert here</button>
      <button class="btn" :disabled="state.push !== 'on'" @click="testPush">Test push</button>
    </div>

    <div class="lbl" style="margin-top: 16px">Backup &amp; transfer</div>
    <p class="reason">Save your tasks to a file or restore them on another browser/device.</p>
    <div class="row">
      <button class="btn" @click="exportJson">Export JSON</button>
      <button class="btn" @click="fileInput?.click()">Import JSON</button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onPickBackup" />
    </div>

    <button class="btn block" style="margin-top: 12px" @click="resetDemo(); closeSheet()">Reset demo data</button>
    <button class="btn primary block" @click="closeSheet">Close</button>
  </BottomSheet>
</template>
