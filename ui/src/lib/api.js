import { store } from '../store/index.js';

export const STATUS_VALUES = ['new', 'ack', 'escalated', 'resolved'];

export const setAlertStatus = (alertId, status, uid) => store.updateAlertStatus(alertId, status, uid);
export const assignAlert = (alertId, uid) => store.assignAlert(alertId, uid);
export const writeAudit = (uid, action, target) => store.writeAudit(uid, action, target);
export const createIncident = (payload) => store.createIncident(payload);
export const setIncidentStatus = (incidentId, status, uid) => store.setIncidentStatus(incidentId, status, uid);
