import { getApiUrl } from '../config';

export const REPO_URL = 'https://github.com/bkarkusashvili/currency-converter';

export const README_URL = `${REPO_URL}#readme`;

export function swaggerUrl(): string {
  return `${getApiUrl()}/docs`;
}

export function healthUrl(): string {
  return `${getApiUrl()}/health`;
}
