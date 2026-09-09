import { useTranslation } from 'react-i18next';
import { REPO_URL, healthUrl, livenessUrl, swaggerUrl } from '../../../lib';
import { ExternalLink } from './ExternalLink';
import { HealthStatus } from './HealthStatus';

/**
 * Where this deployment actually is, and what it says about itself right now.
 * Under 640 the health report comes first: it is the part that changes, and a
 * reviewer opening the page wants to see it without scrolling past four links.
 */
export function LiveCard() {
  const { t } = useTranslation();

  return (
    <section
      id="live"
      aria-labelledby="live-heading"
      className="card grid scroll-mt-20 gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10 sm:px-7 sm:py-6"
    >
      <div className="border-line order-2 grid gap-3.5 border-t pt-4 sm:order-1 sm:border-t-0 sm:pt-0">
        <h2 id="live-heading" className="eyebrow">
          {t('about.live.heading')}
        </h2>
        <ul className="grid gap-2.5">
          <li>
            <ExternalLink
              href={REPO_URL}
              label={t('about.live.repository')}
              hint={t('about.live.repositoryHint')}
            />
          </li>
          <li>
            <ExternalLink href={swaggerUrl()} label={t('about.live.apiDocs')} hint={swaggerUrl()} />
          </li>
          <li>
            <ExternalLink href={healthUrl()} label={t('about.live.health')} hint={healthUrl()} />
          </li>
          <li>
            <ExternalLink
              href={livenessUrl()}
              label={t('about.live.liveness')}
              hint={livenessUrl()}
            />
          </li>
        </ul>
      </div>

      <div className="border-line order-1 grid content-start gap-3 sm:order-2 sm:min-w-[13.75rem] sm:border-l sm:pl-8">
        <HealthStatus />
      </div>
    </section>
  );
}
