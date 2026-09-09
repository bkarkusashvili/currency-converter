import { useTranslation } from 'react-i18next';
import type { ApiError, FieldError } from '../api';
import { useApiErrorMessage } from '../lib';
import { WarningIcon } from './WarningIcon';

interface ApiErrorNoticeProps {
  error: ApiError;
  /** Field errors the form could not place on an input; the rest are shown here. */
  fieldErrors?: FieldError[];
  /** One sentence about what this failure means here, when the code alone does not say it. */
  note?: string;
}

export function ApiErrorNotice({ error, fieldErrors = [], note }: ApiErrorNoticeProps) {
  const { t } = useTranslation();
  const messageOf = useApiErrorMessage();

  return (
    <div
      role="alert"
      className="rounded-card border-danger/30 bg-danger-soft flex gap-3 border p-4 sm:gap-3.5 sm:p-5"
    >
      <WarningIcon className="text-danger mt-0.5 h-5 w-5 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="text-danger font-semibold text-pretty">
          {messageOf(error)}
          {/* The lead-in only makes sense when messages actually follow it. */}
          {fieldErrors.length > 0 && ` ${t('errors.fieldErrorsLead')}`}
        </p>

        {fieldErrors.length > 0 && (
          <ul className="text-ink mt-3 space-y-1 text-sm">
            {fieldErrors.map((fieldError, index) => (
              <li key={fieldError.field ?? index} className="flex gap-2">
                {fieldError.field !== undefined && (
                  <span className="text-muted font-mono text-xs tracking-[0.08em] uppercase">
                    {fieldError.field}
                  </span>
                )}
                <span className="min-w-0 break-words">{fieldError.messages.join(' ')}</span>
              </li>
            ))}
          </ul>
        )}

        {note !== undefined && <p className="text-ink mt-3 text-sm text-pretty">{note}</p>}

        <p className="eyebrow mt-3 break-words">
          {error.code}
          {error.requestId !== undefined && ` · ${t('errors.requestId', { id: error.requestId })}`}
        </p>
      </div>
    </div>
  );
}
