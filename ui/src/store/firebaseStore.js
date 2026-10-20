import { collection, limit, onSnapshot, orderBy, query, doc, updateDoc, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider, getMessagingInstance, vapidKey } from '../firebase.js';
import { getToken, onMessage } from 'firebase/messaging';

function subscribe(name, orderField, max, cb) {
  const q = query(collection(db, name), orderBy(orderField, 'desc'), limit(max));
  const unsub = onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  return unsub;
}

export const firebaseStore = {
  mode: 'firebase',

  onAuth(cb) {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        cb({ user: null, role: null, isAdmin: false });
        return;
      }
      let role = 'analyst';
      try {
        const token = await u.getIdTokenResult();
        role = token.claims.role || 'analyst';
      } catch {
        role = 'analyst';
      }
      cb({ user: u, role, isAdmin: role === 'admin' });
    });
    return unsub;
  },

  loginEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
  loginGoogle: () => signInWithPopup(auth, googleProvider),
  logout: () => signOut(auth),

  subscribeCollection: (name, orderField, cb) => subscribe(name, orderField, 500, cb),

  async updateAlertStatus(id, status, uid) {
    await updateDoc(doc(db, 'alerts', id), { status, updatedAt: new Date().toISOString(), assignedTo: uid || null });
    await this.writeAudit(uid, `alert.${status}`, id);
  },

  async assignAlert(id, uid) {
    await updateDoc(doc(db, 'alerts', id), { assignedTo: uid, updatedAt: new Date().toISOString() });
    await this.writeAudit(uid, 'alert.assign', id);
  },

  async writeAudit(actorUid, action, target) {
    await addDoc(collection(db, 'audit'), { actorUid, action, target, timestamp: new Date().toISOString() });
  },

  async createIncident({ title, alertIds, uid }) {
    const ref = await addDoc(collection(db, 'incidents'), {
      title,
      alertIds,
      status: 'open',
      assignedTo: uid,
      createdAt: new Date().toISOString(),
    });
    await this.writeAudit(uid, 'incident.create', ref.id);
    return ref.id;
  },

  async setIncidentStatus(incidentId, status, uid) {
    await updateDoc(doc(db, 'incidents', incidentId), { status, updatedAt: new Date().toISOString() });
    await this.writeAudit(uid, `incident.${status}`, incidentId);
  },

  async registerPush(uid) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const messaging = getMessagingInstance();
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (token) {
      await addDoc(collection(db, 'fcm_tokens'), { uid, token, subscribed: false });
    }
    return token;
  },

  onPush(cb) {
    const messaging = getMessagingInstance();
    onMessage(messaging, cb);
    return () => {};
  },
};
