import { getApiUrl } from '../config';

export const REPO_URL = 'https://github.com/bkarkusashvili/currency-converter';

export function swaggerUrl(): string {
  return `${getApiUrl()}/docs`;
}

export function healthUrl(): string {
  return `${getApiUrl()}/health`;
}
