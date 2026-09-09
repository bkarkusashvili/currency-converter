import { useTranslation } from 'react-i18next';
import { PROCESS_URL, README_URL, TRACEABILITY_URL } from '../../../lib';
import { useActiveSection } from '../hooks/useActiveSection';
import { BulletList } from './BulletList';
import { CommandBlock } from './CommandBlock';
import { CountTable } from './CountTable';
import { ContentSection } from './ContentSection';
import { ExternalLink } from './ExternalLink';
import { LiveCard } from './LiveCard';
import { ParagraphList } from './ParagraphList';
import { PointList } from './PointList';
import { SectionIndex, type IndexEntry } from './SectionIndex';

/**
 * The page in reading order, and the index that names it. One list, so a
 * section added without an entry is a missing chip rather than a silent gap.
 */
const SECTIONS = [
  { id: 'live', titleKey: 'about.live.heading' },
  { id: 'where-it-stands', titleKey: 'about.status.title' },
  { id: 'what-was-built', titleKey: 'about.whatWasBuilt.title' },
  { id: 'requirements', titleKey: 'about.traceability.navTitle' },
  { id: 'two-layer-fallback', titleKey: 'about.fallback.title' },
  { id: 'why-these-decisions', titleKey: 'about.whyTheseDecisions.title' },
  { id: 'how-to-run-it', titleKey: 'about.howToRun.title' },
  { id: 'process', titleKey: 'about.process.navTitle' },
] as const satisfies readonly IndexEntry[];

const SECTION_IDS = SECTIONS.map((section) => section.id);

/**
 * The design fixes two type steps and draws no third, so the one heading level
 * below a section is body copy set bold rather than a size invented for it.
 */
function Subheading({ children }: { children: string }) {
  return <h3 className="mt-2 font-semibold">{children}</h3>;
}

export function AboutPage() {
  const { t } = useTranslation();
  const active = useActiveSection(SECTION_IDS);

  const purpose = t('about.purpose', { returnObjects: true });
  const statusItems = t('about.status.items', { returnObjects: true });
  const builtPoints = t('about.whatWasBuilt.points', { returnObjects: true });
  const fallback = t('about.fallback.paragraphs', { returnObjects: true });
  const whyPoints = t('about.whyTheseDecisions.points', { returnObjects: true });
  const tracePoints = t('about.traceability.points', { returnObjects: true });
  const runBlocks = t('about.howToRun.blocks', { returnObjects: true });
  const runNotes = t('about.howToRun.notes', { returnObjects: true });
  const processParagraphs = t('about.process.paragraphs', { returnObjects: true });
  const processStages = t('about.process.stages.items', { returnObjects: true });
  const processNumbers = t('about.process.numbers.rows', { returnObjects: true });
  const processExamples = t('about.process.examples.points', { returnObjects: true });

  return (
    <div className="shell lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-16">
      <SectionIndex entries={SECTIONS} active={active} />

      <div className="mt-6 grid max-w-[45rem] gap-8 lg:mt-0 lg:gap-12">
        <div className="grid gap-3 sm:gap-4">
          <p className="eyebrow">{t('about.eyebrow')}</p>
          <h1 className="page-title">{t('about.heading')}</h1>
          <ParagraphList paragraphs={purpose} />
        </div>

        <LiveCard />

        <ContentSection id="where-it-stands" title={t('about.status.title')}>
          <BulletList items={statusItems} />
        </ContentSection>

        <ContentSection id="what-was-built" title={t('about.whatWasBuilt.title')}>
          <PointList points={builtPoints} />
        </ContentSection>

        <ContentSection id="requirements" title={t('about.traceability.title')}>
          <p className="text-muted text-sm text-pretty">
            {t('about.traceability.intro')}{' '}
            <ExternalLink href={TRACEABILITY_URL} label={t('about.traceability.readmeLabel')} />
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
          <p className="text-muted text-sm text-pretty">
            {t('about.howToRun.intro')}{' '}
            <ExternalLink href={README_URL} label={t('about.howToRun.readmeLabel')} />
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {runBlocks.map((block) => (
              <CommandBlock key={block.caption} caption={block.caption} commands={block.commands} />
            ))}
          </div>
          <div className="grid gap-2">
            {runNotes.map((note) => (
              <p key={note} className="text-muted text-sm text-pretty">
                {note}
              </p>
            ))}
          </div>
        </ContentSection>

        <ContentSection id="process" title={t('about.process.title')}>
          <ParagraphList paragraphs={processParagraphs} />

          <Subheading>{t('about.process.stages.title')}</Subheading>
          <BulletList items={processStages} />

          <Subheading>{t('about.process.numbers.title')}</Subheading>
          <CountTable
            caption={t('about.process.numbers.caption')}
            metricHeading={t('about.process.numbers.metricHeading')}
            valueHeading={t('about.process.numbers.valueHeading')}
            rows={processNumbers}
          />

          <Subheading>{t('about.process.examples.title')}</Subheading>
          <p className="text-muted text-sm text-pretty">{t('about.process.examples.intro')}</p>
          <PointList points={processExamples} />

          <p className="text-muted text-sm text-pretty">
            {t('about.process.linkIntro')}{' '}
            <ExternalLink href={PROCESS_URL} label={t('about.process.linkLabel')} />
          </p>
        </ContentSection>
      </div>
    </div>
  );
}
