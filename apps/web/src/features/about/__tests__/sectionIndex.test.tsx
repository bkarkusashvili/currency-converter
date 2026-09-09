import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { i18nInstance } from '../../../i18n';
import { createFakeServices, FAKE_RESPONSES } from '../../../test/fakes/createFakeServices';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { AboutPage } from '../components/AboutPage';
import { SectionIndex } from '../components/SectionIndex';
import { useActiveSection } from '../hooks/useActiveSection';

/**
 * The observer jsdom does not have. Registering it as a global lets the hook
 * take the branch a browser takes, and `emit` plays the callback the browser
 * would call on a scroll.
 */
interface FakeObserver {
  observed: string[];
  emit: (entries: { id: string; isIntersecting: boolean }[]) => void;
  disconnected: boolean;
}

function installObserver(): FakeObserver {
  const state: FakeObserver = { observed: [], emit: () => undefined, disconnected: false };

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        state.emit = (entries) => {
          callback(
            entries.map(
              (entry) =>
                ({
                  target: { id: entry.id } as Element,
                  isIntersecting: entry.isIntersecting,
                }) as IntersectionObserverEntry,
            ),
            this as unknown as IntersectionObserver,
          );
        };
      }

      observe(element: Element) {
        state.observed.push(element.id);
      }

      disconnect() {
        state.disconnected = true;
      }

      unobserve() {
        // The hook disconnects rather than unobserving one at a time.
      }
    },
  );

  return state;
}

function Probe({ ids }: { ids: readonly string[] }) {
  const active = useActiveSection(ids);
  return <p>active {active ?? 'none'}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useActiveSection', () => {
  it('marks the first section before anything has scrolled', () => {
    render(<Probe ids={['live', 'where-it-stands']} />);

    expect(screen.getByText('active live')).toBeInTheDocument();
  });

  it('follows the topmost section on screen, in page order', () => {
    const observer = installObserver();
    const ids = ['live', 'where-it-stands', 'what-was-built'];
    document.body.innerHTML = ids.map((id) => `<section id="${id}"></section>`).join('');

    render(<Probe ids={ids} />, {
      container: document.body.appendChild(document.createElement('div')),
    });

    expect(observer.observed).toEqual(ids);

    // Two showing at once: the index names the one nearer the top of the page,
    // not the one whose entry arrived last.
    act(() => {
      observer.emit([
        { id: 'what-was-built', isIntersecting: true },
        { id: 'where-it-stands', isIntersecting: true },
      ]);
    });
    expect(screen.getByText('active where-it-stands')).toBeInTheDocument();

    act(() => {
      observer.emit([{ id: 'where-it-stands', isIntersecting: false }]);
    });
    expect(screen.getByText('active what-was-built')).toBeInTheDocument();
  });

  it('keeps the last answer when nothing is on screen at all', () => {
    const observer = installObserver();
    document.body.innerHTML = '<section id="live"></section>';

    render(<Probe ids={['live', 'where-it-stands']} />, {
      container: document.body.appendChild(document.createElement('div')),
    });

    act(() => {
      observer.emit([{ id: 'live', isIntersecting: false }]);
    });

    expect(screen.getByText('active live')).toBeInTheDocument();
  });

  it('stops observing when the page goes away', () => {
    const observer = installObserver();
    const { unmount } = render(<Probe ids={['live']} />);

    unmount();

    expect(observer.disconnected).toBe(true);
  });
});

describe('SectionIndex', () => {
  const entries = [
    { id: 'live', titleKey: 'about.live.heading' },
    { id: 'requirements', titleKey: 'about.traceability.navTitle' },
  ] as const;

  it('links to each section and marks the one being read', () => {
    render(
      <I18nextProvider i18n={i18nInstance}>
        <SectionIndex entries={entries} active="requirements" />
      </I18nextProvider>,
    );

    const nav = screen.getByRole('navigation', { name: 'On this page' });
    expect(screen.getByRole('link', { name: 'Live' })).toHaveAttribute('href', '#live');

    const current = screen.getByRole('link', { name: 'Requirements' });
    expect(current).toHaveAttribute('href', '#requirements');
    // The section being read, not a page this link would navigate to.
    expect(current).toHaveAttribute('aria-current', 'location');
    expect(nav).toContainElement(current);
    expect(screen.getByRole('link', { name: 'Live' })).not.toHaveAttribute('aria-current');
  });

  it('makes the link itself the thumb target and draws the pill inside it', () => {
    render(
      <I18nextProvider i18n={i18nInstance}>
        <SectionIndex entries={entries} active="requirements" />
      </I18nextProvider>,
    );

    const link = screen.getByRole('link', { name: 'Live' });

    // The nav scrolls horizontally, and a scrollport clips what is drawn
    // outside it, so the band has to be padding inside the anchor's own box
    // rather than a taller pseudo-element painted around the pill.
    expect(link).toHaveClass('min-h-11', 'py-2');
    expect(link.firstElementChild).toHaveTextContent('Live');
  });
});

describe('the About page index', () => {
  beforeEach(() => {
    window.__APP_CONFIG__ = { apiUrl: 'https://api.test' };
  });

  it('names every section on the page, and every entry has a section to reach', () => {
    const fake = createFakeServices({ health: FAKE_RESPONSES.health });
    renderWithProviders(<AboutPage />, { services: fake.services });

    const nav = screen.getByRole('navigation', { name: 'On this page' });
    const targets = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('#') === true)
      .map((link) => link.getAttribute('href')?.slice(1));

    expect(targets).toEqual([
      'live',
      'where-it-stands',
      'what-was-built',
      'requirements',
      'two-layer-fallback',
      'why-these-decisions',
      'how-to-run-it',
      'process',
    ]);
    for (const id of targets) {
      expect(document.getElementById(id as string), `no section for #${id ?? ''}`).not.toBeNull();
    }
    // The chip reads short; the heading it points at is the full sentence.
    expect(nav).toHaveTextContent('Requirements');
    expect(
      screen.getByRole('heading', { name: 'Requirements, and where each one is' }),
    ).toBeInTheDocument();
  });
});
