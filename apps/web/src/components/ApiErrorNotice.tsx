import { extractFieldErrors, type ApiError } from '../api/errors';

export function ApiErrorNotice({ error }: { error: ApiError }) {
  const fieldErrors = extractFieldErrors(error);

  return (
    <div role="alert" className="rounded-card border-danger/30 bg-danger-soft border p-4 sm:p-5">
      <p className="text-danger font-semibold">{error.message}</p>

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
        {error.requestId !== undefined && ` · request ${error.requestId}`}
      </p>
    </div>
  );
}
