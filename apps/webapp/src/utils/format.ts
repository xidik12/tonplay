/**
 * Formatting utilities for display values throughout the app.
 */

/**
 * Format a ticket balance with comma separators and ticket icon.
 */
export function formatTickets(n: number): string {
  return `${n.toLocaleString('en-US')} \ud83c\udfab`;
}

/**
 * Format a TPLAY balance with 2 decimal places and symbol.
 */
export function formatTplay(n: number): string {
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TPLAY`;
}

/**
 * Format a number with locale-aware separators.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format a large number with K/M/B suffixes.
 */
export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Truncate a TON address for display.
 * "UQBk...x3Ab" format.
 */
export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/**
 * Format a relative time ago string.
 */
export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;

  return new Date(then).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a multiplier value for display.
 */
export function formatMultiplier(m: number): string {
  return `${m.toFixed(2)}x`;
}

/**
 * Format a percentage value.
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a duration in seconds to MM:SS format.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format an XP value with level context.
 */
export function formatXP(xp: number, nextLevelXp: number): string {
  return `${formatNumber(xp)} / ${formatNumber(nextLevelXp)} XP`;
}

/**
 * Get level from XP using a simple formula.
 * Each level requires level * 100 XP.
 */
export function getLevelFromXP(xp: number): { level: number; currentXp: number; nextLevelXp: number } {
  let level = 1;
  let totalRequired = 0;

  while (true) {
    const required = level * 100;
    if (totalRequired + required > xp) {
      return {
        level,
        currentXp: xp - totalRequired,
        nextLevelXp: required,
      };
    }
    totalRequired += required;
    level++;
  }
}
