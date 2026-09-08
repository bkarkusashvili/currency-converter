import { useTranslation } from 'react-i18next';
import { useFormatters } from '../lib/useFormatters';

interface TimestampProps {
  value: string;
  className?: string;
}

export function Timestamp({ value, className }: TimestampProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const stamp = formatters.timestamp(value);

  if (stamp === null) {
    return <span className={className}>{t('common.unknownTime')}</span>;
  }

  return (
    <time className={className} dateTime={stamp.iso} title={stamp.title}>
      {stamp.text}
    </time>
  );
}
