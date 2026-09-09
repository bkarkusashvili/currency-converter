import { useTranslation } from 'react-i18next';
import { RANGE_DAYS, type RangeDays } from '../lib/rateHistoryRange';

const LABEL_KEY = {
  7: 'rateHistory.range.d7',
  30: 'rateHistory.range.d30',
  90: 'rateHistory.range.d90',
} as const satisfies Record<RangeDays, string>;

interface RangeControlProps {
  value: RangeDays;
  onChange: (days: RangeDays) => void;
  /** The panel has nothing to range over, so the control is dimmed — but never disabled (§3.19). */
  dimmed?: boolean;
}

/**
 * The same anatomy as the header's theme switcher, text instead of icons: an
 * outer 1px group at 44px total, three 40px segments inside it. Native radios
 * again, so the arrow keys and the "2 of 3" a screen reader reads are the
 * platform's.
 *
 * Dimmed while the panel is loading or empty rather than disabled: switching
 * the range is how a reader finds out whether a wider window has anything in
 * it, and a disabled control would be the panel's failure spreading to the one
 * thing that could answer it.
 *
 * What dims is the chrome, not the type. Fading the whole group to 0.6 put its
 * unselected labels at 2.62:1 in light, and a control a reader is being invited
 * to use has to stay readable while it is being invited: instead the selected
 * segment's fill drops to half strength and the labels move to `--ink-faint`,
 * which measure 16.29:1 and 5.50:1 in light and 15.65:1 and 5.88:1 in dark —
 * every one of them past 4.5:1 in both themes. Nothing at all now happens to
 * the border, which is the header's theme switcher's (`--line` in light,
 * `--line-strong` in dark), so the group's own edge does not move when the
 * panel has nothing to range over.
 */
export function RangeControl({ value, onChange, dimmed = false }: RangeControlProps) {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t('rateHistory.range.label')}
      className="border-line bg-raised dark:border-line-strong grid grid-cols-3 gap-0.5 rounded-lg border p-0.5 sm:flex"
    >
      {RANGE_DAYS.map((days) => (
        <label
          key={days}
          className={[
            'inline-flex h-10 cursor-pointer items-center justify-center rounded-md font-mono text-xs tracking-[0.08em] transition-colors sm:min-w-14 sm:px-3',
            'has-[:focus-visible]:outline-accent has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-2',
            value === days
              ? `text-ink font-semibold ${dimmed ? 'bg-sunken/50' : 'bg-sunken'}`
              : dimmed
                ? 'text-faint hover:bg-surface hover:text-ink'
                : 'text-muted hover:bg-surface hover:text-ink',
          ].join(' ')}
        >
          <input
            type="radio"
            name="rate-history-range"
            value={days}
            className="sr-only"
            checked={value === days}
            onChange={() => {
              onChange(days);
            }}
          />
          {t(LABEL_KEY[days])}
        </label>
      ))}
    </div>
  );
}
