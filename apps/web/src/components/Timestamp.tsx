import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../lib';
import type { TimestampKind } from '../lib';

interface TimestampProps {
  value: string;
  className?: string;
  /**
   * Reads the value as part of the sentence in front of it, which needs "at"
   * before a clock time and "on" before a date but nothing before "yesterday".
   */
  withPreposition?: boolean;
  /**
   * A sentence that carries the time itself — "Fetched {{time}}" — for a line
   * where the label and the value are one phrase rather than two. Takes
   * precedence over `withPreposition`, which is the two-phrase shape.
   */
  sentenceKey?: ParseKeys;
}

const PREPOSITION_KEY = {
  clock: 'common.timeAt',
  relative: 'common.timeWhen',
  calendar: 'common.timeOn',
} as const satisfies Record<TimestampKind, string>;

export function Timestamp({
  value,
  className,
  withPreposition = false,
  sentenceKey,
}: TimestampProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const stamp = formatters.timestamp(value);

  if (stamp === null) {
    return <span className={className}>{t('common.unknownTime')}</span>;
  }

  const text =
    sentenceKey !== undefined
      ? t(sentenceKey, { time: stamp.text })
      : withPreposition
        ? t(PREPOSITION_KEY[stamp.kind], { time: stamp.text })
        : stamp.text;

  return (
    <time className={className} dateTime={stamp.iso} title={stamp.title}>
      {text}
    </time>
  );
}
