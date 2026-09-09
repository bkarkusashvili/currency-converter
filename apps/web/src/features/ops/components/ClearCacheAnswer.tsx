import { useTranslation } from 'react-i18next';
import { type ApiError } from '../../../api';
import { WarningIcon } from '../../../components';
import { useApiErrorMessage } from '../../../lib';
import { shortenRequestId } from '../lib/sessionActions';

export interface ClearAnswer {
  status: number;
  requestId: string | undefined;
  error: ApiError | null;
}

/**
 * What the route answered, in the three shapes it has (§3.24): `204` in accent,
 * `401` and `503` in danger. Nothing new is invented for the failures — the
 * sentence is the one `ApiErrorNotice` would read out of the same envelope, and
 * the meta line is the code and the request id it arrived with.
 */
export function ClearCacheAnswer({ answer }: { answer: ClearAnswer }) {
  const { t } = useTranslation();
  const messageOf = useApiErrorMessage();
  const succeeded = answer.error === null;

  const meta = [
    succeeded
      ? String(answer.status)
      : `${String(answer.status)} ${answer.error?.code ?? ''}`.trim(),
    answer.requestId === undefined
      ? undefined
      : t('errors.requestId', { id: shortenRequestId(answer.requestId) }),
  ].filter((part) => part !== undefined);

  return (
    <div
      role="status"
      className={[
        'flex items-start gap-3 rounded-[0.625rem] px-4 py-3.5',
        succeeded
          ? 'bg-accent-soft text-accent'
          : 'border-danger/30 bg-danger-soft text-danger border',
      ].join(' ')}
    >
      {succeeded ? (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
          className="mt-px h-[1.125rem] w-[1.125rem] shrink-0"
        >
          <path
            d="m3 8.5 3 3 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <WarningIcon className="mt-px h-[1.125rem] w-[1.125rem] shrink-0" />
      )}

      <div className="grid gap-0.5 text-sm">
        <span className="font-semibold text-pretty">
          {answer.error === null ? t('ops.clear.success') : messageOf(answer.error)}
        </span>
        {/* Not uppercased: the status and the error code arrive that way
            already, and the request id is a value read back off a header —
            the action log below prints the same id in the same case. */}
        <span
          className={[
            'font-mono text-[0.6875rem] tracking-[0.12em]',
            succeeded ? 'opacity-80' : 'text-faint',
          ].join(' ')}
        >
          {meta.join(' · ')}
        </span>
      </div>
    </div>
  );
}
