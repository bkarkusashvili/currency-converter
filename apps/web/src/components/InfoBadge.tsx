export type BadgeTone = 'neutral' | 'accent' | 'warn';

interface InfoBadgeProps {
  /** What the value is. Omitted where the surrounding row already says it. */
  label?: string;
  value: string;
  tone?: BadgeTone;
  /**
   * The badge is standing on the sunken output pane or a tinted history row,
   * where its own ground would disappear into it (§6.4, §6.5).
   */
  onSunken?: boolean;
  /** The tighter chip a history row wears, where the badge is the whole line. */
  compact?: boolean;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'badge',
  accent: 'badge badge-accent',
  warn: 'badge badge-warn',
};

const LABEL_CLASS: Record<BadgeTone, string> = {
  neutral: 'text-faint',
  accent: 'opacity-75',
  warn: 'opacity-75',
};

/** A glanceable chip. The explanation is visible text next to it, not a tooltip. */
export function InfoBadge({
  label,
  value,
  tone = 'neutral',
  onSunken = false,
  compact = false,
}: InfoBadgeProps) {
  return (
    <span
      className={[
        TONE_CLASS[tone],
        onSunken ? 'badge-on-sunken' : '',
        compact ? 'px-2 py-[0.1875rem]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label !== undefined && <span className={LABEL_CLASS[tone]}>{label}</span>}
      {value}
    </span>
  );
}
