import { Fragment } from 'react';
import type { ConversionStrategy } from '../../api/types';
import { HUB_CURRENCY } from './provenance';

interface ConversionPathProps {
  from: string;
  to: string;
  strategy: ConversionStrategy;
}

function pathFor(from: string, to: string, strategy: ConversionStrategy): string[] {
  switch (strategy) {
    case 'identity':
      return [from];
    case 'cross':
      return [from, HUB_CURRENCY, to];
    case 'direct':
      return [from, to];
  }
}

export function ConversionPath({ from, to, strategy }: ConversionPathProps) {
  const nodes = pathFor(from, to, strategy);

  return (
    <ol aria-label={`Conversion path: ${nodes.join(' to ')}`} className="flex items-center">
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
                ? 'border-transparent bg-accent-soft text-accent'
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
