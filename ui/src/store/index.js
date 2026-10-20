import { demoStore } from './demoStore.js';
import { firebaseStore } from './firebaseStore.js';

const params = new URLSearchParams(window.location.search);
if (params.get('demo') !== null) {
  localStorage.setItem('demo-mode', '1');
}
if (params.get('live') !== null) {
  localStorage.removeItem('demo-mode');
}

export const isDemo = import.meta.env.VITE_DEMO_MODE === '1' || localStorage.getItem('demo-mode') === '1';

export const store = isDemo ? demoStore : firebaseStore;
