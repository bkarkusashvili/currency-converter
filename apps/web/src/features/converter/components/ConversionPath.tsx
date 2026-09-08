import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { conversionPath } from '../lib/provenance';

interface ConversionPathProps {
  from: string;
  to: string;
  strategy: string;
}

/**
 * The hops the rate was priced through, as one line. A cross rate is the case
 * it exists for: `EUR → UAH → GBP` is the only place the hub currency appears
 * as a number's ancestor rather than as prose.
 */
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
            <li
              aria-hidden="true"
              className="text-line-strong flex min-w-6 flex-1 items-center gap-1 px-2 sm:max-w-20"
            >
              <span className="h-px flex-1 bg-current" />
              <svg viewBox="0 0 8 8" focusable="false" className="h-2 w-2 shrink-0">
                <path
                  d="M2 1 5 4 2 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </li>
          )}
          <li
            className={[
              'numeric font-mono text-xs tracking-[0.1em] uppercase',
              'rounded-md border px-2.5 py-1.5',
              index === nodes.length - 1 && nodes.length > 1
                ? 'bg-accent-soft text-accent border-transparent font-medium'
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
