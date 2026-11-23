<script setup>
import { ref } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { state, byId, updateTask, closeSheet } from '../store.js';
import { hoursLeft, fmtHours } from '@shared/priority.js';

const t = byId(state.sheet.taskId);
const pct = ref(t.progress || 10);

async function submit() {
  await updateTask(t.id, { progress: Number(pct.value) }, 'progress',
    (after) => `Saved · ${fmtHours(hoursLeft(after))} of work left`);
  closeSheet();
}
</script>

<template>
  <BottomSheet title="How much is done?">
    <p class="reason">Tell TickMark what you already did, so the work left is right.</p>
    <form @submit.prevent="submit">
      <label for="pr">Done: <output>{{ pct }}</output>%</label>
      <input id="pr" v-model="pct" type="range" min="0" max="100" step="10" />
      <div class="row" style="margin-top: 12px; grid-template-columns: 1fr 1fr 1fr">
        <button v-for="v in [25, 50, 75]" :key="v" type="button" class="btn" @click="pct = v">{{ v }}%</button>
      </div>
      <div class="row" style="margin-top: 18px">
        <button type="button" class="btn" @click="closeSheet">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>
  </BottomSheet>
</template>
