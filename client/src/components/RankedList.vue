<script setup>
import { computed } from 'vue';
import UrgencyTag from './UrgencyTag.vue';
import { state, ranked, doneTasks, go, move, resetOrder, openSheet } from '../store.js';
import { level, reason } from '@shared/priority.js';
import { enablePush, unlockAudio } from '../alerts.js';

const LABEL = { now: 'Start now', today: 'Start today', later: 'Later' };
const showPushBanner = computed(() => state.push === 'off' || state.push.startsWith('error'));

async function turnOn() {
  unlockAudio();
  state.push = await enablePush();
}
</script>

<template>
  <div>
    <div v-if="showPushBanner" class="banner">
      <span>Turn on alerts so your phone rings when it is time to start, even when the app is closed.</span>
      <button class="btn" @click="turnOn">Turn on</button>
    </div>
    <div v-else-if="state.push === 'denied'" class="banner">
      <span>Notifications are blocked. Allow them for this site in your browser settings to get alerts in your pocket.</span>
    </div>
    <div v-else-if="state.push === 'unsupported'" class="banner">
      <span>This browser cannot ring when the app is closed. On iPhone, tap Share → Add to Home Screen, then open TickMark from there.</span>
    </div>
    <p v-if="state.push.startsWith('error')" class="reason" role="alert">Could not turn on alerts: {{ state.push.slice(6) }}</p>

    <div v-if="!ranked.length" class="empty">
      <p><b>Nothing due.</b></p>
      <p>Add a homework, quiz or test and TickMark ranks it for you.</p>
    </div>

    <ol class="ranked">
      <li v-for="({ task, moved }, i) in ranked" :key="task.id">
        <button
          class="task"
          :aria-label="`Rank ${i + 1}: ${task.title}, ${task.course}. ${LABEL[level(task, state.now)]}. ${reason(task, state.now)}`"
          @click="go('detail', task.id)"
        >
          <span class="num" aria-hidden="true">{{ i + 1 }}</span>
          <span>
            <UrgencyTag :level="level(task, state.now)" />
            <span v-if="moved" class="moved">moved by you</span>
            <h3>{{ task.title }} · {{ task.course }}</h3>
            <p class="reason">{{ reason(task, state.now) }}</p>
          </span>
        </button>
        <span class="reorder">
          <button :aria-label="`Move ${task.title} up`" :disabled="i === 0" @click="move(task.id, -1)">▲</button>
          <button :aria-label="`Move ${task.title} down`" :disabled="i === ranked.length - 1" @click="move(task.id, 1)">▼</button>
        </span>
      </li>
    </ol>

    <button v-if="state.manualOrder.length" class="btn block" style="margin: 0 0 12px" @click="resetOrder">Use app order again</button>

    <div class="row">
      <button class="btn" @click="openSheet('add')">+ Add</button>
      <button class="btn" @click="go('week')">Week</button>
    </div>
    <button v-if="doneTasks.length" class="btn block" @click="go('done')">Done ({{ doneTasks.length }})</button>

    <details style="margin-top: 16px; font-size: 0.88em">
      <summary>How is this list ranked?</summary>
      <div class="explain" style="margin-top: 8px">
        Work left = estimated hours × part not done.<br />
        Start by = deadline − work left × 2.<br />
        Rank = (grade % + 5) ÷ hours until start-by. If start-by has passed, the task goes to the top and your phone rings.<br /><br />
        TickMark does not know about extensions or work you did unless you tell it. Open a task to fix it.
      </div>
    </details>
  </div>
</template>
