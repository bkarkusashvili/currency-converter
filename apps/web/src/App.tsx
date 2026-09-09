import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router';
import { AppFooter, AppHeader } from './components';
import { AboutPage } from './features/about';
import { ConverterPage } from './features/converter';
import { OpsPage } from './features/ops';

export function App() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <AppHeader />
      <main id="main" className="flex-1 pt-7 pb-10 sm:pt-12 sm:pb-20">
        <Routes>
          <Route path="/" element={<ConverterPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/ops" element={<OpsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AppFooter />
    </div>
  );
}
