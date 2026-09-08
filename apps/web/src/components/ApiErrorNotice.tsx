import { useTranslation } from 'react-i18next';
import type { ApiError } from '../api/http/ApiError';
import type { FieldError } from '../api/http/fieldErrors';
import { errorMessageKey } from '../i18n/errorMessageKey';

interface ApiErrorNoticeProps {
  error: ApiError;
  /** Field errors the form could not place on an input; the rest are shown here. */
  fieldErrors?: FieldError[];
}

export function ApiErrorNotice({ error, fieldErrors = [] }: ApiErrorNoticeProps) {
  const { t } = useTranslation();
  const key = errorMessageKey(error.code);
  const message = key === null ? error.message : t(key, { replace: error.details });

  return (
    <div role="alert" className="rounded-card border-danger/30 bg-danger-soft border p-4 sm:p-5">
      <p className="text-danger font-semibold">{message}</p>

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

      <p className="eyebrow mt-3">
        {error.code}
        {error.requestId !== undefined && ` · ${t('errors.requestId', { id: error.requestId })}`}
      </p>
    </div>
  );
}
