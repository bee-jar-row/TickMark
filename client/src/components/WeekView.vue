<script setup>
import { computed } from 'vue';
import { state, go } from '../store.js';
import { startBy, level, statusText, HOUR } from '@shared/priority.js';

const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const days = computed(() => {
  const start = new Date(state.now);
  start.setHours(0, 0, 0, 0);
  const open = state.tasks.filter((t) => !t.done);
  return Array.from({ length: 7 }, (_, i) => {
    const d0 = new Date(start.getTime() + i * 24 * HOUR);
    const d1 = new Date(d0.getTime() + 24 * HOUR);
    const inDay = (d) => d >= d0 && d < d1;
    return {
      key: d0.toISOString(),
      name: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d0.toLocaleDateString('en-GB', { weekday: 'long' }),
      date: d0.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      today: i === 0,
      due: open.filter((t) => inDay(new Date(t.deadline))).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)),
      starts: open.filter((t) => inDay(startBy(t))),
    };
  });
});
const later = computed(() => {
  const end = new Date(state.now); end.setHours(0, 0, 0, 0);
  return state.tasks.filter((t) => !t.done && new Date(t.deadline) >= new Date(end.getTime() + 7 * 24 * HOUR)).length;
});
</script>

<template>
  <div>
    <p class="reason" style="margin: 0 0 10px">Deadlines and start-by times for the next 7 days. Tap one to open it.</p>
    <div class="week">
      <section v-for="d in days" :key="d.key" class="day" :class="{ 'is-today': d.today }" :aria-label="d.name">
        <h4><span>{{ d.name }}</span><span style="font-weight: 400">{{ d.date }}</span></h4>
        <small v-if="!d.due.length && !d.starts.length" style="color: var(--ink-2)">Nothing</small>
        <button v-for="t in d.due" :key="'d' + t.id" class="chip" :class="level(t, state.now)" @click="go('detail', t.id)">
          <b>Due {{ time(t.deadline) }}</b> · {{ t.title }} · {{ t.course }}<br />
          <small>{{ t.weight }}% of grade · {{ statusText(t) }}</small>
        </button>
        <button v-for="t in d.starts" :key="'s' + t.id" class="chip start" :class="level(t, state.now)" @click="go('detail', t.id)">
          <b>Start by {{ time(startBy(t)) }}</b> · {{ t.title }}
        </button>
      </section>
    </div>
    <p v-if="later" class="reason" style="margin-top: 10px">{{ later }} more due after this week.</p>
  </div>
</template>
