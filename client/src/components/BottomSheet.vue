<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { closeSheet } from '../store.js';

defineProps({ title: String });
const box = ref(null);
let lastFocus = null;

function onKey(e) {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Tab' && box.value) { // keep focus inside the dialog
    const f = box.value.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
}
onMounted(() => {
  lastFocus = document.activeElement;
  document.addEventListener('keydown', onKey);
  box.value?.querySelector('input, select, button')?.focus();
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  lastFocus?.focus?.();
});
</script>

<template>
  <div class="sheet-bg" @click.self="closeSheet">
    <div ref="box" class="sheet" role="dialog" aria-modal="true" :aria-label="title">
      <h3>{{ title }}</h3>
      <slot />
    </div>
  </div>
</template>
