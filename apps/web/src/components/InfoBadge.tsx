export type BadgeTone = 'neutral' | 'accent' | 'warn';

interface InfoBadgeProps {
  label: string;
  value: string;
  description: string;
  tone?: BadgeTone;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'badge',
  accent: 'badge badge-accent',
  warn: 'badge badge-warn',
};

export function InfoBadge({ label, value, description, tone = 'neutral' }: InfoBadgeProps) {
  return (
    <span
      className={TONE_CLASS[tone]}
      title={description}
      aria-label={`${label}: ${value}. ${description}`}
    >
      <span className="text-faint">{label}</span>
      {value}
    </span>
  );
}
