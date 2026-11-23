<script setup>
import { computed, onMounted, onBeforeUnmount, watchEffect, nextTick, ref } from 'vue';
import RankedList from './components/RankedList.vue';
import TaskDetail from './components/TaskDetail.vue';
import WeekView from './components/WeekView.vue';
import DoneList from './components/DoneList.vue';
import TaskForm from './components/TaskForm.vue';
import DeadlineForm from './components/DeadlineForm.vue';
import ProgressForm from './components/ProgressForm.vue';
import EstimateForm from './components/EstimateForm.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import {
  state, live, init, refresh, go, openSheet, undo, snooze, byId,
  checkForeground, onPushMessage,
} from './store.js';
import { reason } from '@shared/priority.js';
import { pushStatus } from './alerts.js';

const TITLES = { list: 'Ranked list', detail: 'Task detail', week: 'Week', done: 'Done' };
const SHEETS = { add: TaskForm, edit: TaskForm, deadline: DeadlineForm, progress: ProgressForm, estimate: EstimateForm, settings: SettingsPanel };
const view = computed(() => ({ list: RankedList, detail: TaskDetail, week: WeekView, done: DoneList })[state.view.name]);
const alertBtn = ref(null);

watchEffect(() => {
  document.body.classList.toggle('hc', !!state.settings.hc);
  document.body.classList.toggle('big', !!state.settings.big);
});
watchEffect(() => { if (state.alert) nextTick(() => alertBtn.value?.focus()); });

function openFromAlert() {
  const id = state.alert?.task?.id;
  state.alert = null;
  if (id && byId(id)) go('detail', id);
}
function snoozeFromAlert() {
  const id = state.alert?.task?.id;
  state.alert = null;
  if (id && byId(id)) snooze(id);
}

function onSwMessage(e) {
  if (e.data?.type === 'push-alert') onPushMessage(e.data.payload);
  if (e.data?.type === 'open-task' && e.data.taskId) refresh().then(() => go('detail', e.data.taskId));
}
function onVisible() {
  if (document.visibilityState === 'visible') { refresh().then(checkForeground); pushStatus().then((s) => (state.push = s)); }
}
function onKey(e) { if (e.key === 'Escape' && state.alert) state.alert = null; }

let timer;
onMounted(async () => {
  await init();
  state.push = await pushStatus();
  checkForeground();
  timer = setInterval(checkForeground, 20000);
  navigator.serviceWorker?.addEventListener('message', onSwMessage);
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  navigator.serviceWorker?.removeEventListener('message', onSwMessage);
  document.removeEventListener('visibilitychange', onVisible);
  document.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div class="phone">
    <div class="screen">
      <header>
        <button class="hbtn" :class="{ ghost: state.view.name === 'list' }" aria-label="Back" @click="go('list')">‹</button>
        <h1>{{ TITLES[state.view.name] }}</h1>
        <button class="hbtn" aria-label="Settings" @click="openSheet('settings')">⚙</button>
      </header>

      <main id="main" tabindex="-1">
        <div v-if="state.error" class="banner err" role="alert">{{ state.error }}</div>
        <div v-if="!state.ready" class="empty">Loading…</div>
        <component :is="view" v-else @back="go('list')" />
      </main>

      <div v-if="state.alert" class="alert" role="alertdialog" aria-labelledby="alertTitle" aria-describedby="alertBody">
        <h3 id="alertTitle"><span aria-hidden="true">⏰</span> Time to start</h3>
        <p id="alertBody">
          <template v-if="state.alert.test">[Test] </template>
          {{ state.alert.task.title }} · {{ state.alert.task.course }}: {{ reason(state.alert.task, state.now) }}.
          Start now so you do not run out of time.
        </p>
        <div class="row">
          <button ref="alertBtn" class="btn primary" @click="openFromAlert">Open task</button>
          <button class="btn" @click="snoozeFromAlert">Remind in 30 min</button>
        </div>
      </div>

      <component :is="SHEETS[state.sheet.type]" v-if="state.sheet" :key="state.sheet.type + state.sheet.taskId" />

      <div v-if="state.toast" class="toast" role="status">
        <span>{{ state.toast.msg }}</span>
        <button v-if="state.toast.undo" @click="state.toast = null; undo()">Undo</button>
      </div>
      <div class="sr" aria-live="assertive">{{ live.text }}</div>
    </div>
  </div>
</template>
