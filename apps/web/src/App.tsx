import { Navigate, Route, Routes } from 'react-router';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { AboutPage } from './features/about/AboutPage';
import { ConverterPage } from './features/converter/ConverterPage';

export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1 pb-20">
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
