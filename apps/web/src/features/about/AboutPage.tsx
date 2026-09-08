import { REPO_URL, healthUrl, swaggerUrl } from '../../lib/links';
import { HealthStatus } from './HealthStatus';
import { howToRun, purpose, whatWasBuilt, whyTheseDecisions, type ContentSection } from './content';

export function AboutPage() {
  return (
    <div className="shell pt-10 pb-4 sm:pt-16">
      <p className="eyebrow">For the reviewer</p>
      <h1 className="mt-3 max-w-2xl text-[clamp(1.9rem,5.5vw,2.75rem)]">
        A currency converter, built as a service.
      </h1>
      <p className="text-muted mt-5 max-w-2xl text-base">{purpose}</p>

      <section aria-labelledby="live-heading" className="card mt-10 p-5 sm:p-7">
        <h2 id="live-heading" className="eyebrow">
          Live
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-[1fr_auto] sm:gap-10">
          <ul className="grid gap-2.5">
            <li>
              <ExternalLink
                href={REPO_URL}
                label="Source on GitHub"
                hint="bkarkusashvili/currency-converter"
              />
            </li>
            <li>
              <ExternalLink href={swaggerUrl()} label="API documentation" hint={swaggerUrl()} />
            </li>
            <li>
              <ExternalLink href={healthUrl()} label="Health endpoint" hint={healthUrl()} />
            </li>
          </ul>
          <div className="border-line border-t pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-10">
            <HealthStatus />
          </div>
        </div>
      </section>

      <ContentBlock section={whatWasBuilt} />
      <ContentBlock section={whyTheseDecisions} />

      <section aria-labelledby={howToRun.id} className="mt-14">
        <h2 id={howToRun.id} className="border-line border-b pb-3 text-lg">
          {howToRun.title}
        </h2>
        <pre className="bg-sunken border-line mt-5 overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-6">
          {howToRun.commands.join('\n')}
        </pre>
        {howToRun.notes.map((note) => (
          <p key={note} className="text-muted mt-3 text-sm">
            {note}
          </p>
        ))}
      </section>
    </div>
  );
}

function ContentBlock({ section }: { section: ContentSection }) {
  return (
    <section aria-labelledby={section.id} className="mt-14">
      <h2 id={section.id} className="border-line border-b pb-3 text-lg">
        {section.title}
      </h2>
      <dl className="mt-5 grid gap-6 sm:grid-cols-2">
        {section.points.map((point) => (
          <div key={point.term}>
            <dt className="font-semibold">{point.term}</dt>
            <dd className="text-muted mt-1.5 text-sm">{point.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ExternalLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group inline-flex flex-col">
      <span className="group-hover:text-accent font-semibold underline decoration-transparent underline-offset-4 transition group-hover:decoration-current">
        {label} <span aria-hidden="true">↗</span>
      </span>
      <span className="text-faint font-mono text-xs">{hint}</span>
    </a>
  );
}
