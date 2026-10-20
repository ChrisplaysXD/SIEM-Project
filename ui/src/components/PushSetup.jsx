import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { store } from '../store/index.js';
import { useAuth } from '../auth.jsx';

export function PushSetup() {
  const { user, isDemo } = useAuth();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    if (isDemo) {
      const unsub = store.onPush((payload) => {
        setToast(`${payload.notification.title}: ${payload.notification.body}`);
        setTimeout(() => setToast(null), 8000);
      });
      return unsub;
    }

    let cancelled = false;
    store
      .registerPush(user.uid)
      .then((token) => {
        if (!cancelled && token) {
          setDoc(doc(db, 'fcm_tokens', token), { uid: user.uid, subscribed: false }, { merge: true }).catch(() => {});
        }
      })
      .catch((err) => console.warn('push setup failed', err));
    const unsub = store.onPush((payload) => {
      if (cancelled) return;
      const n = payload.notification;
      setToast(n ? `${n.title}: ${n.body}` : 'New alert');
      setTimeout(() => setToast(null), 8000);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, isDemo]);

  return toast && <div className="toast">{toast}</div>;
}
