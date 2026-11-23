<script setup>
import { reactive } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { state, byId, addTask, updateTask, closeSheet } from '../store.js';
import { DIFF_HOURS, HOUR } from '@shared/priority.js';
import { toLocalInput } from '../time.js';

const editing = state.sheet.type === 'edit' ? byId(state.sheet.taskId) : null;
const f = reactive({
  title: editing?.title ?? '',
  course: editing?.course ?? '',
  deadline: toLocalInput(editing?.deadline ?? Date.now() + 48 * HOUR),
  weight: editing?.weight ?? 10,
  difficulty: editing?.difficulty ?? 'medium',
});

async function submit() {
  const data = { ...f, deadline: new Date(f.deadline).toISOString(), weight: Number(f.weight) };
  if (editing) {
    if (data.difficulty !== editing.difficulty) data.hours = null; // new label -> use its guess again
    await updateTask(editing.id, data, 'edit', 'Saved');
  } else {
    await addTask(data);
  }
  closeSheet();
}
</script>

<template>
  <BottomSheet :title="editing ? 'Edit task' : 'Add a task'">
    <p class="reason">Type it once. TickMark keeps the date and the grade together.</p>
    <form @submit.prevent="submit">
      <label for="fTitle">What is it?</label>
      <input id="fTitle" v-model="f.title" required maxlength="120" placeholder="e.g. Essay 2, Quiz 3" />
      <label for="fCourse">Class</label>
      <input id="fCourse" v-model="f.course" required maxlength="120" placeholder="e.g. Data Structures" />
      <label for="fDl">Deadline</label>
      <input id="fDl" v-model="f.deadline" type="datetime-local" required />
      <label for="fW">Part of final grade (%)</label>
      <input id="fW" v-model="f.weight" type="number" min="0" max="100" step="1" required />
      <fieldset>
        <legend>How hard?</legend>
        <div class="seg">
          <label v-for="(h, k) in DIFF_HOURS" :key="k">
            <input v-model="f.difficulty" type="radio" name="fD" :value="k" />
            <span>{{ k[0].toUpperCase() + k.slice(1) }}<br /><small>{{ h }} h</small></span>
          </label>
        </div>
      </fieldset>
      <div class="row" style="margin-top: 18px">
        <button type="button" class="btn" @click="closeSheet">Cancel</button>
        <button class="btn primary">{{ editing ? 'Save' : 'Add' }}</button>
      </div>
    </form>
  </BottomSheet>
</template>
