import type { ResponseWarning } from '../api/types';
import { useWarningMessage } from '../lib/useWarningMessage';
import { WarningIcon } from './WarningIcon';

interface WarningNotesProps {
  warnings: ResponseWarning[] | undefined;
  className?: string;
}

/**
 * What degraded while a successful request was answered. Not an error notice:
 * the answer above it is the answer, and this is the footnote that says what it
 * cost. Absent when there is nothing to say — which, per §3, is most of the
 * time.
 */
export function WarningNotes({ warnings, className }: WarningNotesProps) {
  const messageOf = useWarningMessage();

  if (warnings === undefined || warnings.length === 0) {
    return null;
  }

  return (
    <ul className={['text-warn grid gap-1.5 text-sm', className].filter(Boolean).join(' ')}>
      {warnings.map((warning) => (
        <li key={warning.code} className="flex items-start gap-2">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 text-pretty">{messageOf(warning)}</span>
        </li>
      ))}
    </ul>
  );
}
