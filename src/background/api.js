import { normalizeOrgId } from '../utils/orgId.js';

const API_BASE = 'https://claude.ai/api';
const CLAUDE_ORIGIN = 'https://claude.ai';

export async function getOrgId() {
  const result = await chrome.storage.local.get('orgId');
  if (result.orgId) return normalizeOrgId(result.orgId);
  const cookieOrgId = await getOrgIdFromCookie();
  if (cookieOrgId) {
    await chrome.storage.local.set({ orgId: cookieOrgId });
    return cookieOrgId;
  }
  return null;
}

export async function getOrgIdFromCookie() {
  try {
    const cookie = await chrome.cookies.get({ url: CLAUDE_ORIGIN, name: 'lastActiveOrg' });
    return normalizeOrgId(cookie?.value);
  } catch (error) {
    console.error('Unable to read lastActiveOrg cookie:', error);
    return null;
  }
}

export async function fetchUsageFromAPI(orgId) {
  const url = `${API_BASE}/organizations/${orgId}/usage`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
  if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
  return await response.json();
}

export async function getSubscriptionTier(orgId) {
  try {
    const url = `${API_BASE}/bootstrap/${orgId}/app_start?statsig_hashing_algorithm=djb2`;
    const response = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch subscription tier');
    const data = await response.json();
    const org = data.account?.memberships?.[0]?.organization;
    if (!org) return 'unknown';
    if (org.raven_type) return 'Claude Team';
    else if (org.capabilities?.includes('claude_max')) {
      const tier = org.rate_limit_tier || '';
      if (tier.includes('20x')) return 'Claude Max (20x)';
      else if (tier.includes('5x')) return 'Claude Max (5x)';
      return 'Claude Max';
    } else if (org.capabilities?.includes('claude_pro')) return 'Claude Pro';
    return 'Claude Free';
  } catch (error) {
    console.error('Error fetching subscription tier:', error);
    return 'unknown';
  }
}
