import { useEffect, useState } from 'react';

/**
 * Which section the reader is in, for the index beside the page. The observer
 * is the cheap way to ask — no scroll handler, no measuring on every frame —
 * and the bottom margin keeps the answer to the top half of the viewport, so
 * a heading scrolling into the last few pixels does not claim the index.
 *
 * `IntersectionObserver` is guarded rather than assumed: without it the first
 * section stays marked, which is what the page opens on anyway.
 */
export function useActiveSection(ids: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const onScreen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onScreen.add(entry.target.id);
          } else {
            onScreen.delete(entry.target.id);
          }
        }

        // The topmost of what is showing, in page order rather than in the
        // order the entries happened to arrive.
        const first = ids.find((id) => onScreen.has(id));
        if (first !== undefined) {
          setActive(first);
        }
      },
      { rootMargin: '-88px 0px -55% 0px' },
    );

    for (const id of ids) {
      const section = document.getElementById(id);
      if (section !== null) {
        observer.observe(section);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [ids]);

  return active;
}
