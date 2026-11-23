import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { registerSW } from './alerts.js';

registerSW();
createApp(App).mount('#app');
