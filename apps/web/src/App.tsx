import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { AboutPage } from './features/about/components/AboutPage';
import { ConverterPage } from './features/converter/components/ConverterPage';

export function App() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <AppHeader />
      <main id="main" className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<ConverterPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AppFooter />
    </div>
  );
}
