export type BadgeTone = 'neutral' | 'accent' | 'warn';

interface InfoBadgeProps {
  /** What the value is. Omitted where the surrounding row already says it. */
  label?: string;
  value: string;
  tone?: BadgeTone;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'badge',
  accent: 'badge badge-accent',
  warn: 'badge badge-warn',
};

/** A glanceable chip. The explanation is visible text next to it, not a tooltip. */
export function InfoBadge({ label, value, tone = 'neutral' }: InfoBadgeProps) {
  return (
    <span className={TONE_CLASS[tone]}>
      {label !== undefined && <span className="text-faint">{label}</span>}
      {value}
    </span>
  );
}
