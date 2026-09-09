import { useEffect, useState } from 'react';

const TICK_MS = 1000;

/**
 * The current time, re-read once a second, for a page that draws a countdown.
 * `until` is the moment there is nothing left to count — the ticker stops on
 * its own when it passes it, so an expired snapshot is not a timer running for
 * as long as the tab is open. `null` means there is nothing to count yet.
 *
 * It also stops while the tab is in the background, where a per-second render
 * is work nobody can see, and reads the clock again on the way back so the
 * first frame after a return is the right one rather than the one from before.
 */
export function useSecondsTicker(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) {
      return;
    }

    const deadline = until;
    let timer: ReturnType<typeof setInterval> | undefined;

    function stop() {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    }

    function tick() {
      setNow(Date.now());
      if (Date.now() >= deadline) {
        stop();
      }
    }

    function start() {
      if (timer === undefined && Date.now() < deadline) {
        timer = setInterval(tick, TICK_MS);
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    }

    start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [until]);

  return now;
}
