export function formatResetTime(isoTimestamp) {
  if (!isoTimestamp) return '--';
  try {
    const date = new Date(isoTimestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (error) { return 'Unknown'; }
}

export function formatCountdown(isoDate) {
  if (!isoDate) return '--';
  const resetTime = new Date(isoDate).getTime();
  if (Number.isNaN(resetTime)) return '--';
  const remainingMs = resetTime - Date.now();
  if (remainingMs <= 0) return 'now';
  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
