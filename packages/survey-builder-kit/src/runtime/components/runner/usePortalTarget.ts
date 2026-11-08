import { useLayoutEffect, useState } from 'react';
import type { PortalTarget } from '../../../SurveyRunner';

// Tri-state result a `render*To` prop resolves to:
// - `undefined` -- the input itself was `undefined` (prop omitted). What
//   this MEANS is up to the caller -- RunnerShell coerces this to `null`
//   before calling in for three of the four pieces (see its own comment),
//   so only `renderAssessmentTo` ever actually produces this: render the
//   piece inline, in its built-in spot.
// - `null` -- input was `null`/`""`/coerced-from-omitted, OR a selector
//   string matched nothing (after warning); render nothing for this piece.
// - `Element` -- portal the piece into this DOM node via `createPortal`.
export type ResolvedPortalTarget = Element | null | undefined;

// Resolves a host-supplied `render*To` target into an actual DOM node (or
// one of the sentinels above). Never touches `document` during render --
// only inside the layout effect below, which React only ever runs on the
// client -- so importing/rendering this library on the server stays safe
// (see the README's SSR note): the very first render (server, and the first
// client paint before this effect fires) always reports `undefined`,
// regardless of what `target` actually is, matching the existing "inert
// shell until it hydrates" contract -- it's up to each call site whether
// `undefined` means "built-in" or "hidden" (see `ResolvedPortalTarget`'s own
// comment). `useLayoutEffect` (not `useEffect`) so the swap to the real
// target/hidden state happens before the browser paints, not after --
// avoiding a visible flash of that initial state first.
//
// Re-resolves whenever `target` itself changes (a different selector, a
// swapped-in HTMLElement, or toggling to/from null/undefined).
export function usePortalTarget(propName: string, target: PortalTarget | undefined): ResolvedPortalTarget {
  const [resolved, setResolved] = useState<ResolvedPortalTarget>(undefined);

  useLayoutEffect(() => {
    if (target === undefined) {
      setResolved(undefined);
      return;
    }
    if (target === null || target === '') {
      setResolved(null);
      return;
    }
    if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (!el) {
        console.warn(
          `survey-builder-kit: ${propName}="${target}" did not match any element in the document -- rendering nothing for this piece.`,
        );
      }
      setResolved(el ?? null);
      return;
    }
    setResolved(target);
  }, [propName, target]);

  return resolved;
}

// A portaled piece renders outside the runner's own root element, so it
// misses out on `bgColor` (applied to that root's `className` -- see
// SurveyRunner.tsx), and has no built-in way for host CSS to target it
// specifically. This combines `bgColor` (if any) with a stable, library-
// owned class name so a host can still theme/target each portaled piece
// from its own stylesheet, e.g. `.sbk-steps { ... }`.
export function portalWrapperClassName(bgColor: string | undefined, stableClassName: string): string {
  return [bgColor, stableClassName].filter(Boolean).join(' ');
}
