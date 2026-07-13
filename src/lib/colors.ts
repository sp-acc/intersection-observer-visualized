/** Earthy palette for the debug overlay. */
export const COLORS = {
  /** Intersection rect fill */
  terracotta: '#C1663E',
  /** rootMargin zone strips */
  moss: '#6B7F3F',
  /** Root outline, HUD text */
  bark: '#4A3B2A',
  /** HUD background */
  sand: '#E8DCC3',
  /** Threshold badge / accents */
  sage: '#9CAF88',
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
