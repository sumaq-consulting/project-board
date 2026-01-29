/**
 * Convert ISO timestamp to relative time string
 * e.g., "2h ago", "yesterday", "3 days ago"
 */
export function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else if (diffDay === 1) {
    return 'yesterday';
  } else if (diffDay < 7) {
    return `${diffDay} days ago`;
  } else if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Get emoji for activity action type
 */
export function getActivityEmoji(action: string): string {
  const emojiMap: Record<string, string> = {
    status_change: '🔄',
    work_completed: '✅',
    docs_updated: '📝',
    note: '💬',
    blocked: '⚠️',
    unblocked: '🟢',
  };
  return emojiMap[action] || '📝';
}
