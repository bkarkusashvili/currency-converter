import type { ApiError } from '../../../api/http/ApiError';
import { extractFieldErrors, type FieldError } from '../../../api/http/fieldErrors';

const FORM_FIELDS = ['amount', 'from', 'to'] as const;

export type FormField = (typeof FORM_FIELDS)[number];

export type FormFieldErrors = Partial<Record<FormField, string[]>>;

export interface SplitFieldErrors {
  /** Errors the form can put on an input. */
  fields: FormFieldErrors;
  /** Everything else, for the notice. */
  rest: FieldError[];
}

export function splitServerFieldErrors(error: ApiError | null): SplitFieldErrors {
  if (error === null) {
    return { fields: {}, rest: [] };
  }

  return extractFieldErrors(error).reduce<SplitFieldErrors>(
    (split, fieldError) => {
      const field = asFormField(fieldError.field);
      if (field === null) {
        return { fields: split.fields, rest: [...split.rest, fieldError] };
      }
      return {
        fields: {
          ...split.fields,
          [field]: [...(split.fields[field] ?? []), ...fieldError.messages],
        },
        rest: split.rest,
      };
    },
    { fields: {}, rest: [] },
  );
}

function asFormField(field: string | undefined): FormField | null {
  return FORM_FIELDS.find((candidate) => candidate === field) ?? null;
}
