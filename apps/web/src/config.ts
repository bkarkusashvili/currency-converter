export interface AppConfig {
  apiUrl: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

const FALLBACK_API_URL = 'http://localhost:3000';

export function getApiUrl(): string {
  const configured = window.__APP_CONFIG__?.apiUrl;
  const apiUrl =
    typeof configured === 'string' && configured.trim() !== '' ? configured : FALLBACK_API_URL;
  return apiUrl.replace(/\/+$/, '');
}
