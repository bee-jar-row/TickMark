<script setup>
import { computed } from 'vue';
import UrgencyTag from './UrgencyTag.vue';
import { state, byId, openSheet, setDone, undo, deleteTask } from '../store.js';
import { level, reason, startBy, hoursLeft, effort, fmtHours, fmtDate, statusText } from '@shared/priority.js';

const t = computed(() => byId(state.view.id));
</script>

<template>
  <div v-if="t" class="detail">
    <UrgencyTag :level="level(t, state.now)" />
    <h2>{{ t.title }} · {{ t.course }}</h2>

    <div class="field">
      <span class="k">Deadline</span><span>{{ fmtDate(t.deadline) }}</span>
      <button class="pencil" aria-label="Edit deadline" @click="openSheet('deadline', t.id)">✎</button>
    </div>
    <div class="field"><span class="k">Status</span><span>{{ t.done ? 'done' : statusText(t) }}</span></div>
    <div class="field">
      <span class="k">Estimated</span>
      <span>
        {{ fmtHours(hoursLeft(t)) }} left of {{ effort(t) }} h
        <span class="est-note">({{ t.hours != null ? 'set by you' : `from “${t.difficulty}”` }})</span>
      </span>
      <button class="pencil" aria-label="Edit effort estimate" @click="openSheet('estimate', t.id)">✎</button>
    </div>
    <div class="field"><span class="k">Start by</span><span>{{ fmtDate(startBy(t)) }}</span></div>
    <div class="field"><span class="k">Grade</span><span>{{ t.weight }}%</span></div>

    <p class="why">{{ reason(t, state.now) }}</p>
    <div class="explain">
      This is a guess from your deadline, {{ t.weight }}% grade weight and {{ effort(t) }} h effort.
      If any of these is wrong, fix it below. The list and the ring time update at once.
    </div>

    <div class="row">
      <button class="btn" :disabled="t.done" @click="openSheet('progress', t.id)">Already started</button>
      <button class="btn" :disabled="t.done" @click="openSheet('deadline', t.id)">Deadline extended</button>
      <button class="btn" :class="{ primary: !t.done }" @click="setDone(t.id, !t.done)">{{ t.done ? 'Not done yet' : 'Done' }}</button>
      <button class="btn" :disabled="!state.history.length" @click="undo">Undo</button>
    </div>
    <button class="btn block" @click="openSheet('edit', t.id)">Edit name, class or grade %</button>
    <button class="btn warn block" @click="deleteTask(t.id)">Delete task</button>
  </div>
  <div v-else class="empty">This task is gone. <button class="btn" @click="$emit('back')">Back to list</button></div>
</template>
