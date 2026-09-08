import { useTranslation } from 'react-i18next';
import { getApiUrl } from '../config';

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-line border-t py-6">
      <div className="shell text-faint flex flex-wrap items-center justify-between gap-3 font-mono text-[0.6875rem] tracking-[0.08em] uppercase">
        <span>{t('app.footer.rates')}</span>
        <span>{t('app.footer.api', { url: getApiUrl() })}</span>
      </div>
    </footer>
  );
}
