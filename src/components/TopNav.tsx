import { useEffect, useRef } from 'react';
import { hrefFor, useRoute } from '../lib/router';
import { TEXT_SCALES, useSession } from '../store/session';
import { useTest } from '../store/test';
import { useUi } from '../store/ui';
import { HelpButton } from './Help';
import { IconMoon, IconSun } from './Icons';

const LINKS = [
  { path: '/', label: 'Question Bank' },
  { path: '/build', label: 'Build Test' },
  { path: '/history', label: 'History' },
  { path: '/dashboard', label: 'Dashboard' },
];

export function TopNav() {
  const { path } = useRoute();
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const scale = useSession((s) => s.textScale);
  const setScale = useSession((s) => s.setTextScale);
  const idx = TEXT_SCALES.indexOf(scale);
  const bankQuery = useUi((s) => s.bankQuery);
  const testName = useTest((s) => s.test?.name);
  const ref = useRef<HTMLElement>(null);

  // full-height pages size themselves below the bar, which wraps onto two rows on phones
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--nav-h');
    };
  }, []);

  return (
    <header ref={ref} className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85 print:hidden">
      <nav aria-label="Main" className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-2 px-4 sm:h-14 sm:flex-nowrap">
        <a href={hrefFor('/', new URLSearchParams(bankQuery))} className="mr-3 flex h-12 shrink-0 items-center gap-2 font-semibold tracking-tight text-ink sm:h-auto">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-accent-ink">Q</span>
          <span className="max-[380px]:sr-only">SAT Question Bank</span>
        </a>
        <ul className="order-last -mx-1 flex w-full min-w-0 gap-1 overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:pb-0">
          {LINKS.map((l) => {
            const active = l.path === '/' ? path === '/' : path.startsWith(l.path) || (l.path === '/history' && path.startsWith('/results/'));
            return (
              <li key={l.path}>
                <a
                  href={l.path === '/' ? hrefFor('/', new URLSearchParams(bankQuery)) : hrefFor(l.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
                >
                  {l.label}
                </a>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {testName && (
            <a href={hrefFor('/test')} title={`Resume “${testName}”`} className="mr-1 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover">
              Resume test
            </a>
          )}
          <div className="flex items-center rounded-md border border-line" role="group" aria-label="Text size">
            <button
              type="button"
              className="px-2 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40"
              onClick={() => setScale(TEXT_SCALES[idx - 1])}
              disabled={idx <= 0}
              aria-label="Smaller text"
            >A−</button>
            <button
              type="button"
              className="border-l border-line px-2 py-1 text-sm font-semibold text-muted hover:text-ink disabled:opacity-40"
              onClick={() => setScale(TEXT_SCALES[idx + 1])}
              disabled={idx >= TEXT_SCALES.length - 1}
              aria-label="Larger text"
            >A+</button>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <HelpButton />
        </div>
      </nav>
    </header>
  );
}
