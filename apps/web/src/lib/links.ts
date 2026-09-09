import { getApiUrl } from '../config';

export const REPO_URL = 'https://github.com/bkarkusashvili/currency-converter';

export const README_URL = `${REPO_URL}#readme`;

/** The requirements traceability table in the README, by its GitHub heading anchor. */
export const TRACEABILITY_URL = `${REPO_URL}#requirements-traceability`;

/** The process record, on the default branch so the link survives a rename of the file's section headings. */
export const PROCESS_URL = `${REPO_URL}/blob/main/docs/process.md`;

export function swaggerUrl(): string {
  return `${getApiUrl()}/docs`;
}

export function healthUrl(): string {
  return `${getApiUrl()}/health`;
}

/** The liveness probe, which answers a different question from `/health` — see §3. */
export function livenessUrl(): string {
  return `${getApiUrl()}/health/live`;
}
