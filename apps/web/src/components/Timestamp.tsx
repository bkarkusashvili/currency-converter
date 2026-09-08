import { useTranslation } from 'react-i18next';
import type { TimestampKind } from '../lib/createFormatters';
import { useFormatters } from '../lib/useFormatters';

interface TimestampProps {
  value: string;
  className?: string;
  /**
   * Reads the value as part of the sentence in front of it, which needs "at"
   * before a clock time and "on" before a date but nothing before "yesterday".
   */
  withPreposition?: boolean;
}

const PREPOSITION_KEY = {
  clock: 'common.timeAt',
  relative: 'common.timeWhen',
  calendar: 'common.timeOn',
} as const satisfies Record<TimestampKind, string>;

export function Timestamp({ value, className, withPreposition = false }: TimestampProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const stamp = formatters.timestamp(value);

  if (stamp === null) {
    return <span className={className}>{t('common.unknownTime')}</span>;
  }

  return (
    <time className={className} dateTime={stamp.iso} title={stamp.title}>
      {withPreposition ? t(PREPOSITION_KEY[stamp.kind], { time: stamp.text }) : stamp.text}
    </time>
  );
}
