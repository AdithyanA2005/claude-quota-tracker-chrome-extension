export function normalizeOrgId(value) {
  if (!value) return null;
  let normalized = String(value).trim();
  try { normalized = decodeURIComponent(normalized); } catch (_error) {}
  try {
    const parsed = JSON.parse(normalized);
    if (typeof parsed === "string") normalized = parsed;
    else if (parsed && typeof parsed === "object") normalized = parsed.uuid || parsed.id || parsed.organization_uuid || normalized;
  } catch (_error) {
    normalized = normalized.replace(/^['"]|['"]$/g, "");
  }
  const uuidMatch = normalized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return uuidMatch ? uuidMatch[0] : normalized;
}
