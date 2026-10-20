import { useEffect, useState } from 'react';
import { onMessage, getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db, getMessagingInstance, vapidKey } from '../firebase.js';
import { useAuth } from '../auth.jsx';

export function PushSetup() {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user || !('Notification' in window) || !('serviceWorker' in navigator)) return;

    async function setup() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setDenied(true);
          return;
        }
        const messaging = getMessagingInstance();
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });
        if (token) {
          await setDoc(doc(db, 'fcm_tokens', token), { uid: user.uid, subscribed: false }, { merge: true });
        }
        onMessage(messaging, (payload) => {
          setToast(payload.notification ? `${payload.notification.title}: ${payload.notification.body}` : 'New alert');
          setTimeout(() => setToast(null), 8000);
        });
      } catch (err) {
        console.warn('push setup failed', err);
      }
    }

    setup();
  }, [user]);

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      {denied && <div className="toast denied">Push notifications blocked in this browser</div>}
    </>
  );
}
