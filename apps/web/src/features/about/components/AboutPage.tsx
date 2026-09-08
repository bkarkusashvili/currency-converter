import { useTranslation } from 'react-i18next';
import { README_URL, REPO_URL, healthUrl, livenessUrl, swaggerUrl } from '../../../lib/links';
import { BulletList } from './BulletList';
import { CommandBlock } from './CommandBlock';
import { ContentSection } from './ContentSection';
import { ExternalLink } from './ExternalLink';
import { HealthStatus } from './HealthStatus';
import { ParagraphList } from './ParagraphList';
import { PointList } from './PointList';

export function AboutPage() {
  const { t } = useTranslation();

  const purpose = t('about.purpose', { returnObjects: true });
  const statusItems = t('about.status.items', { returnObjects: true });
  const builtPoints = t('about.whatWasBuilt.points', { returnObjects: true });
  const fallback = t('about.fallback.paragraphs', { returnObjects: true });
  const whyPoints = t('about.whyTheseDecisions.points', { returnObjects: true });
  const tracePoints = t('about.traceability.points', { returnObjects: true });
  const runBlocks = t('about.howToRun.blocks', { returnObjects: true });
  const runNotes = t('about.howToRun.notes', { returnObjects: true });
  const builtParagraphs = t('about.howItWasBuilt.paragraphs', { returnObjects: true });

  return (
    <div className="shell pt-10 pb-4 sm:pt-16">
      <p className="eyebrow">{t('about.eyebrow')}</p>
      <h1 className="mt-3 max-w-2xl text-[clamp(1.9rem,5.5vw,2.75rem)] text-balance">
        {t('about.heading')}
      </h1>
      <ParagraphList paragraphs={purpose} />

      <section aria-labelledby="live-heading" className="card mt-10 p-5 sm:p-7">
        <h2 id="live-heading" className="eyebrow">
          {t('about.live.heading')}
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-[1fr_auto] sm:gap-10">
          <ul className="grid gap-2.5">
            <li>
              <ExternalLink
                href={REPO_URL}
                label={t('about.live.repository')}
                hint={t('about.live.repositoryHint')}
              />
            </li>
            <li>
              <ExternalLink
                href={swaggerUrl()}
                label={t('about.live.apiDocs')}
                hint={swaggerUrl()}
              />
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
          <div className="border-line border-t pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-10">
            <HealthStatus />
          </div>
        </div>
      </section>

      <ContentSection id="where-it-stands" title={t('about.status.title')}>
        <BulletList items={statusItems} />
      </ContentSection>

      <ContentSection id="what-was-built" title={t('about.whatWasBuilt.title')}>
        <PointList points={builtPoints} />
      </ContentSection>

      <ContentSection id="requirements" title={t('about.traceability.title')}>
        <p className="text-muted mt-5 max-w-2xl text-sm">
          {t('about.traceability.intro')}{' '}
          <ExternalLink href={README_URL} label={t('about.traceability.readmeLabel')} />
        </p>
        <PointList points={tracePoints} />
      </ContentSection>

      <ContentSection id="two-layer-fallback" title={t('about.fallback.title')}>
        <ParagraphList paragraphs={fallback} />
      </ContentSection>

      <ContentSection id="why-these-decisions" title={t('about.whyTheseDecisions.title')}>
        <PointList points={whyPoints} />
      </ContentSection>

      <ContentSection id="how-to-run-it" title={t('about.howToRun.title')}>
        <p className="text-muted mt-5 max-w-2xl text-sm">
          {t('about.howToRun.intro')}{' '}
          <ExternalLink href={README_URL} label={t('about.howToRun.readmeLabel')} />
        </p>
        <div className="mt-5 grid gap-5">
          {runBlocks.map((block) => (
            <CommandBlock key={block.caption} caption={block.caption} commands={block.commands} />
          ))}
        </div>
        {runNotes.map((note) => (
          <p key={note} className="text-muted mt-3 text-sm">
            {note}
          </p>
        ))}
      </ContentSection>

      <ContentSection id="how-this-was-built" title={t('about.howItWasBuilt.title')}>
        <ParagraphList paragraphs={builtParagraphs} />
      </ContentSection>
    </div>
  );
}
