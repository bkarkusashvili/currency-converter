import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../../components';
import { useFocusTrap } from '../../../lib';

interface ClearCacheDialogProps {
  open: boolean;
  /** Only its length is used: the dialog previews the header, never the key. */
  keyLength: number;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const MASK_CHARACTER = '•';
const MASK_LENGTH = 16;

/**
 * The confirmation the design puts in front of `DELETE /api/v1/rates/cache`
 * (§3.24), because the command drops the only thing standing between an
 * unreachable Monobank and a 503.
 *
 * Focus lands on Cancel, Escape and the scrim both cancel, and Tab stays
 * inside — a modal in the semantics rather than in a native `<dialog>`, so
 * every one of those behaviours is this component's and is tested as such.
 */
export function ClearCacheDialog({
  open,
  keyLength,
  isPending,
  onCancel,
  onConfirm,
}: ClearCacheDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="scrim" aria-hidden="true" onClick={onCancel} />
      <div className="modal-layer">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-cache-title"
          aria-describedby="clear-cache-body"
          className="overlay-surface modal-card"
        >
          <div className="grid gap-1.5">
            <h2 id="clear-cache-title" className="text-xl">
              {t('ops.clear.confirmTitle')}
            </h2>
            <p id="clear-cache-body" className="text-muted text-sm text-pretty">
              {t('ops.clear.confirmBody')}
            </p>
          </div>

          <div className="bg-sunken text-muted grid gap-2 rounded-[0.625rem] px-3.5 py-3 font-mono text-xs">
            <span>{t('ops.clear.requestPreview')}</span>
            <span>
              {t('ops.clear.keyPreview', {
                mask: MASK_CHARACTER.repeat(Math.min(keyLength, MASK_LENGTH)),
              })}
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              ref={cancelRef}
              className="button button-ghost h-11 px-4 text-sm"
              onClick={onCancel}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="button button-danger h-11 px-4.5 text-sm"
              disabled={isPending}
              aria-busy={isPending}
              onClick={onConfirm}
            >
              {isPending && <Spinner className="h-4 w-4" />}
              {isPending ? t('ops.clear.clearing') : t('ops.clear.confirm')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
