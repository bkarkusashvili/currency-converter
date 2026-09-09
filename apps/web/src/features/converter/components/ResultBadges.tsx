import { useTranslation } from 'react-i18next';
import { InfoBadge } from '../../../components';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { sourceCopy, strategyCopy } from '../lib/provenance';

/**
 * Strategy and source, side by side under the figure. Both sit on the sunken
 * output pane, so the neutral one takes the raised ground instead (§6.4) —
 * a chip has to be a different colour from what it is standing on.
 */
export function ResultBadges({ outcome }: { outcome: ConversionOutcome }) {
  const { t } = useTranslation();
  const strategy = strategyCopy(outcome.strategy);
  const source = sourceCopy(outcome.source);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 sm:h-12">
      <InfoBadge
        label={t('converter.badge.strategy')}
        value={strategy.valueKey === null ? outcome.strategy : t(strategy.valueKey)}
        tone={strategy.tone}
        onSunken
      />
      <InfoBadge
        label={t('converter.badge.source')}
        value={source.valueKey === null ? outcome.source : t(source.valueKey)}
        tone={source.tone}
        onSunken
      />
    </div>
  );
}
