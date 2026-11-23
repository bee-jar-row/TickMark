<script setup>
import { ref, watch } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { state, byId, updateTask, closeSheet } from '../store.js';
import { DIFF_HOURS, startBy, fmtDate } from '@shared/priority.js';

const t = byId(state.sheet.taskId);
const difficulty = ref(t.difficulty);
const hours = ref(t.hours ?? '');
watch(difficulty, () => (hours.value = '')); // picking a label clears the typed hours

async function submit() {
  const h = parseFloat(hours.value);
  await updateTask(t.id, { difficulty: difficulty.value, hours: isNaN(h) ? null : h }, 'estimate',
    (after) => 'Estimate updated · start by ' + fmtDate(startBy(after), { withDate: false }));
  closeSheet();
}
</script>

<template>
  <BottomSheet title="How long will it take?">
    <p class="reason">The app guessed {{ DIFF_HOURS[t.difficulty] }} h from “{{ t.difficulty }}”. You know better — change it.</p>
    <form @submit.prevent="submit">
      <fieldset>
        <legend class="sr">Difficulty</legend>
        <div class="seg">
          <label v-for="(h, k) in DIFF_HOURS" :key="k">
            <input v-model="difficulty" type="radio" name="d" :value="k" />
            <span>{{ k }}<br /><small>{{ h }} h</small></span>
          </label>
        </div>
      </fieldset>
      <label for="hrs">Or type hours yourself</label>
      <input id="hrs" v-model="hours" type="number" min="0.5" max="500" step="0.5" placeholder="e.g. 8" />
      <div class="row" style="margin-top: 18px">
        <button type="button" class="btn" @click="closeSheet">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>
  </BottomSheet>
</template>
