<script setup>
// Urgency is shown with a shape AND a word, so it works without colour (colour-blind safe).
defineProps({ level: { type: String, required: true } });
const LABEL = { now: 'START NOW', today: 'START TODAY', later: 'LATER', done: 'DONE' };
</script>

<template>
  <span class="tag" :class="level">
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <polygon v-if="level === 'now'" points="5,0 10,10 0,10" fill="currentColor" />
      <circle v-else-if="level === 'today'" cx="5" cy="5" r="5" fill="currentColor" />
      <rect v-else-if="level === 'later'" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" />
      <path v-else d="M1 5l3 3 5-7" stroke="currentColor" stroke-width="2" fill="none" />
    </svg>
    {{ LABEL[level] }}
  </span>
</template>
