import path from 'node:path';
import os from 'node:os';

const REQUIRED = ['GCP_PROJECT_ID'];

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`missing required env: ${missing.join(', ')}`);
  }
  return {
    alertsPath: env.ALERTS_PATH || '/var/ossec/logs/alerts/alerts.json',
    serviceAccountPath: env.SERVICE_ACCOUNT_PATH || '/etc/siem-bridge/sa.json',
    projectId: env.GCP_PROJECT_ID,
    offsetPath: env.OFFSET_PATH || '/var/lib/siem-bridge/offset.json',
    vtApiKey: env.VT_API_KEY || '',
    vtMinLevel: Number(env.VT_MIN_LEVEL || 7),
    vtCacheTtlMs: Number(env.VT_CACHE_TTL_MS || 24 * 60 * 60 * 1000),
    vtRequestsPerMinute: Number(env.VT_REQUESTS_PER_MINUTE || 4),
    fcmTopic: env.FCM_TOPIC || 'analysts',
    fcmMinLevel: Number(env.FCM_MIN_LEVEL || 10),
    responseRuleIds: (env.RESPONSE_RULE_IDS || '5710,5712')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    pollIntervalMs: Number(env.POLL_INTERVAL_MS || 1000),
  };
}

export const defaultConfig = loadConfig();
