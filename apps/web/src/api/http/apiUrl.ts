import { getApiUrl } from '../../config';

export function apiUrl(path: string): string {
  return `${getApiUrl()}${path}`;
}
