<script setup>
import BottomSheet from './BottomSheet.vue';
import { state, saveSettings, closeSheet, resetDemo, showAlert, ranked, toast } from '../store.js';
import { unlockAudio, enablePush } from '../alerts.js';
import { api } from '../api.js';

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
    <button class="btn block" @click="resetDemo(); closeSheet()">Reset demo data</button>
    <button class="btn primary block" @click="closeSheet">Close</button>
  </BottomSheet>
</template>
