import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ApiError, useClearRatesCache, useHealth } from '../../../api';
import { breakerState } from '../lib/breakerState';
import { outcomeOf, type SessionAction } from '../lib/sessionActions';
import { AdminKeyField } from './AdminKeyField';
import { ClearCacheAnswer, type ClearAnswer } from './ClearCacheAnswer';
import { ClearCacheDialog } from './ClearCacheDialog';
import { HealthCard } from './HealthCard';
import { SessionActionLog } from './SessionActionLog';
import { SnapshotCard } from './SnapshotCard';

const CLEAR_CACHE_PATH = '/api/v1/rates/cache';
const UNAUTHORIZED = 401;

/**
 * The one page in this client that changes something on the server, and the
 * one that needs a key to do it.
 *
 * The key lives here, in React state, for as long as the tab is open: never
 * `localStorage`, never `sessionStorage`, never a query key and never a log
 * line (§5.2). Closing the tab is how you revoke it.
 */
export function OpsPage() {
  const { t } = useTranslation();
  const health = useHealth();
  const clearCache = useClearRatesCache();
  const keyRef = useRef<HTMLInputElement>(null);

  const [apiKey, setApiKey] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [answer, setAnswer] = useState<ClearAnswer | null>(null);
  const [actions, setActions] = useState<SessionAction[]>([]);

  const monobank = health.data?.details.monobank;
  const upstreamDown = monobank !== undefined && breakerState(monobank) === 'OPEN';

  function record(status: number, requestId: string | undefined) {
    setActions((rows) => [
      {
        id: `${String(Date.now())}-${String(rows.length)}`,
        at: new Date().toISOString(),
        method: 'DELETE',
        path: CLEAR_CACHE_PATH,
        status,
        outcome: outcomeOf(status),
        requestId,
      },
      ...rows,
    ]);
  }

  function confirm() {
    clearCache.mutate(apiKey, {
      onSuccess: (outcome) => {
        setConfirming(false);
        setAnswer({ status: outcome.status, requestId: outcome.requestId, error: null });
        record(outcome.status, outcome.requestId);
      },
      onError: (error: ApiError) => {
        setConfirming(false);
        setAnswer({ status: error.statusCode, requestId: error.requestId, error });
        record(error.statusCode, error.requestId);

        // The key is what a 401 is about, so it is where the caret goes and
        // what wears `aria-invalid` until it is edited.
        if (error.statusCode === UNAUTHORIZED) {
          keyRef.current?.focus();
        }
      },
    });
  }

  return (
    <div className="shell grid gap-5 sm:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-5 sm:gap-8">
        <div className="grid max-w-[40rem] gap-2.5 sm:gap-3">
          <p className="eyebrow">{t('ops.eyebrow')}</p>
          <h1 className="page-title">
            <span className="sm:hidden">{t('ops.headingShort')}</span>
            <span className="hidden sm:inline">{t('ops.heading')}</span>
          </h1>
        </div>

        <AdminKeyField
          value={apiKey}
          invalid={answer?.status === UNAUTHORIZED}
          inputRef={keyRef}
          onChange={(next) => {
            setApiKey(next);
            if (answer?.status === UNAUTHORIZED) {
              setAnswer(null);
            }
          }}
        />
      </div>

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-2">
        <HealthCard />

        <div className="grid gap-3">
          <SnapshotCard
            upstreamDown={upstreamDown}
            hasKey={apiKey !== ''}
            onClear={() => {
              setAnswer(null);
              setConfirming(true);
            }}
          />
          {answer !== null && <ClearCacheAnswer answer={answer} />}
        </div>
      </div>

      <SessionActionLog actions={actions} />

      <ClearCacheDialog
        open={confirming}
        keyLength={apiKey.length}
        isPending={clearCache.isPending}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={confirm}
      />
    </div>
  );
}
