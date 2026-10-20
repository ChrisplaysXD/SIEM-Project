import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const template = fs.readFileSync(path.join(here, '../public/firebase-messaging-sw.template.js'), 'utf8');

const env = {
  API_KEY: process.env.VITE_FB_API_KEY,
  AUTH_DOMAIN: process.env.VITE_FB_AUTH_DOMAIN,
  PROJECT_ID: process.env.VITE_FB_PROJECT_ID,
  STORAGE_BUCKET: process.env.VITE_FB_STORAGE_BUCKET,
  SENDER_ID: process.env.VITE_FB_SENDER_ID,
  APP_ID: process.env.VITE_FB_APP_ID,
};

for (const [key, value] of Object.entries(env)) {
  if (!value) env[key] = `{{${key}}}`;
}

const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.warn(`WARNING: missing firebase env vars for service worker: ${missing.join(', ')} (placeholders kept; push will not work)`);
}

let out = template;
for (const [key, value] of Object.entries(env)) {
  out = out.replaceAll(`{{${key}}}`, value);
}

fs.writeFileSync(path.join(here, '../public/firebase-messaging-sw.js'), out);
console.log('rendered public/firebase-messaging-sw.js');
