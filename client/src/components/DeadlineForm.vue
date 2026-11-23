<script setup>
import { ref } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { state, byId, updateTask, closeSheet } from '../store.js';
import { startBy, fmtDate, HOUR } from '@shared/priority.js';
import { toLocalInput } from '../time.js';

const t = byId(state.sheet.taskId);
const value = ref(toLocalInput(t.deadline));
const add = (h) => (value.value = toLocalInput(new Date(value.value).getTime() + h * HOUR));

async function submit() {
  await updateTask(t.id, { deadline: new Date(value.value).toISOString() }, 'deadline change',
    (after) => 'Deadline updated · new start-by ' + fmtDate(startBy(after), { withDate: false }));
  closeSheet();
}
</script>

<template>
  <BottomSheet title="New deadline">
    <p class="reason">Teacher gave more time, or moved it? Set the new date. The rank and the ring time update.</p>
    <form @submit.prevent="submit">
      <label for="nd">Deadline</label>
      <input id="nd" v-model="value" type="datetime-local" required />
      <div class="row" style="margin-top: 12px">
        <button type="button" class="btn" @click="add(24)">+1 day</button>
        <button type="button" class="btn" @click="add(168)">+1 week</button>
      </div>
      <div class="row" style="margin-top: 18px">
        <button type="button" class="btn" @click="closeSheet">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>
  </BottomSheet>
</template>
