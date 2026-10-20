import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

export const STATUS_VALUES = ['new', 'ack', 'escalated', 'resolved'];

export async function setAlertStatus(alertId, status, uid) {
  await updateDoc(doc(db, 'alerts', alertId), { status, updatedAt: new Date().toISOString(), assignedTo: uid || null });
}

export async function assignAlert(alertId, uid) {
  await updateDoc(doc(db, 'alerts', alertId), { assignedTo: uid, updatedAt: new Date().toISOString() });
}

export async function writeAudit(actorUid, action, target) {
  await addDoc(collection(db, 'audit'), {
    actorUid,
    action,
    target,
    timestamp: new Date().toISOString(),
  });
}

export async function createIncident({ title, alertIds, uid }) {
  const ref = await addDoc(collection(db, 'incidents'), {
    title,
    alertIds,
    status: 'open',
    assignedTo: uid,
    createdAt: new Date().toISOString(),
  });
  await writeAudit(uid, 'incident.create', ref.id);
  return ref.id;
}

export async function setIncidentStatus(incidentId, status, uid) {
  await updateDoc(doc(db, 'incidents', incidentId), { status, updatedAt: new Date().toISOString() });
  await writeAudit(uid, `incident.${status}`, incidentId);
}
