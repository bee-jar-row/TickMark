<script setup>
import { doneTasks, go } from '../store.js';
import { fmtDate } from '@shared/priority.js';
</script>

<template>
  <div>
    <div v-if="!doneTasks.length" class="empty">No finished tasks yet.</div>
    <button v-for="t in doneTasks" :key="t.id" class="task" @click="go('detail', t.id)">
      <span class="num" aria-hidden="true">✓</span>
      <span>
        <h3>{{ t.title }} · {{ t.course }}</h3>
        <p class="reason">Was due {{ fmtDate(t.deadline) }} · {{ t.weight }}% of grade</p>
      </span>
    </button>
  </div>
</template>
