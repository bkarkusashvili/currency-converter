import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../../lib';

interface ArchiveDateProps {
  /** The instant the API reports; only the day it fell on is shown. */
  value: string;
  className?: string;
}

/**
 * When an archived answer's rates are from. The archive keeps one snapshot per
 * day, so this is a date and never a clock time — `Rates from 7 Sep 2026` —
 * and the same line appears in three places: the timestamp eyebrow, the source
 * sentence and the history row (§3.12, §3.13, §3.17).
 *
 * The whole phrase is the `<time>`, which the machine-readable `datetime`
 * carries the instant for; the title keeps the full timestamp for anyone who
 * wants the hour the day's last snapshot was taken.
 */
export function ArchiveDate({ value, className }: ArchiveDateProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const stamp = formatters.timestamp(value);
  const date = formatters.archivedDay(value, 'dayMonthYear');

  if (stamp === null || date === null) {
    return <span className={className}>{t('common.unknownTime')}</span>;
  }

  return (
    <time className={className} dateTime={stamp.iso} title={stamp.title}>
      {t('converter.result.ratesFrom', { date })}
    </time>
  );
}
