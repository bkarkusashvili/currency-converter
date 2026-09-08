import { useTranslation } from 'react-i18next';
import type { ApiError } from '../api/http/ApiError';
import type { FieldError } from '../api/http/fieldErrors';
import { useApiErrorMessage } from '../lib/useApiErrorMessage';

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
    <div role="alert" className="rounded-card border-danger/30 bg-danger-soft border p-4 sm:p-5">
      <p className="text-danger font-semibold">
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
              <span>{fieldError.messages.join(' ')}</span>
            </li>
          ))}
        </ul>
      )}

      {note !== undefined && <p className="text-ink mt-3 text-sm">{note}</p>}

      <p className="eyebrow mt-3">
        {error.code}
        {error.requestId !== undefined && ` · ${t('errors.requestId', { id: error.requestId })}`}
      </p>
    </div>
  );
}
