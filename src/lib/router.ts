// Minimal hash router. Routes and their query strings live after the "#", so a
// static host needs no rewrite rules and a filtered view can be bookmarked:
//   #/?tab=math&diff=Hard&q=circle
import { useMemo, useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('hashchange', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('hashchange', cb);
  };
}

const snapshot = () => window.location.hash;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  const path = (q >= 0 ? raw.slice(0, q) : raw) || '/';
  return { path, params: new URLSearchParams(q >= 0 ? raw.slice(q + 1) : '') };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}

export function hrefFor(path: string, params?: URLSearchParams): string {
  const qs = params?.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

/** Go to a route. `replace` updates the URL without adding a history entry
 *  (used while typing in the search box or toggling filters). */
export function navigate(path: string, params?: URLSearchParams, replace = false): void {
  const href = hrefFor(path, params);
  if (href === window.location.hash) return;
  if (replace) {
    window.history.replaceState(window.history.state, '', href);
    listeners.forEach((cb) => cb());
  } else {
    window.location.hash = href;
  }
}

/** Link to the review of a completed set, at question `n` (1-based) with an optional filter. */
export function reviewHref(key: string, n = 1, filter?: string): string {
  const p = new URLSearchParams({ review: String(n) });
  if (filter && filter !== 'all') p.set('filter', filter);
  return hrefFor(`/results/${key}`, p);
}
