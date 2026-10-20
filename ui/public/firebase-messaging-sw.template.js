importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '{{API_KEY}}',
  authDomain: '{{AUTH_DOMAIN}}',
  projectId: '{{PROJECT_ID}}',
  storageBucket: '{{STORAGE_BUCKET}}',
  messagingSenderId: '{{SENDER_ID}}',
  appId: '{{APP_ID}}',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification ? payload.notification.title : 'SIEM alert';
  const body = payload.notification ? payload.notification.body : 'A new alert was triggered';
  self.registration.showNotification(title, { body, tag: 'siem-alert' });
});
