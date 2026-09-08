import { getApiUrl } from '../config';

export function AppFooter() {
  return (
    <footer className="border-line border-t py-6">
      <div className="shell text-faint flex flex-wrap items-center justify-between gap-3 font-mono text-[0.6875rem] tracking-[0.08em] uppercase">
        <span>Rates from Monobank, crossed through UAH</span>
        <span>API {getApiUrl()}</span>
      </div>
    </footer>
  );
}
