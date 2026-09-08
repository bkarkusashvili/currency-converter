import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { conversionPath } from '../lib/provenance';

interface ConversionPathProps {
  from: string;
  to: string;
  strategy: string;
}

export function ConversionPath({ from, to, strategy }: ConversionPathProps) {
  const { t } = useTranslation();
  const nodes = conversionPath(from, to, strategy);

  return (
    <ol
      aria-label={t('converter.result.pathLabel', { path: nodes.join(' → ') })}
      className="flex items-center"
    >
      {nodes.map((code, index) => (
        <Fragment key={code}>
          {index > 0 && (
            <li aria-hidden="true" className="flex w-14 items-center gap-1.5 px-2">
              <span className="bg-line-strong h-px flex-1" />
              <span className="text-faint font-mono text-[0.625rem] leading-none">▸</span>
            </li>
          )}
          <li
            className={[
              'font-mono text-xs tracking-[0.1em] uppercase',
              'rounded-md border px-2.5 py-1.5',
              index === nodes.length - 1 && nodes.length > 1
                ? 'bg-accent-soft text-accent border-transparent'
                : 'border-line text-muted',
            ].join(' ')}
          >
            {code}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
