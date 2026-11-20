import { useEffect, useRef } from 'react';
import { hrefFor, useRoute } from '../lib/router';
import { TEXT_SCALES, useSession } from '../store/session';
import { useTest } from '../store/test';
import { useUi } from '../store/ui';
import { btn } from './Dialog';
import { HelpButton } from './Help';
import { IconMoon, IconSun, LogoMark } from './Icons';

const LINKS = [
  { path: '/', label: 'Questions' },
  { path: '/build', label: 'Build a set' },
  { path: '/progress', label: 'Progress' },
];

const isActive = (link: string, path: string) =>
  link === '/' ? path === '/'
    : link === '/progress' ? ['/progress', '/dashboard', '/history'].includes(path) || path.startsWith('/results/')
      : path.startsWith(link);

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

  const tool = 'grid h-9 min-w-9 place-items-center rounded-md px-1.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';
  return (
    <header ref={ref} className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85 print:hidden">
      <nav aria-label="Main" className="flex flex-wrap items-center gap-x-3 px-4 sm:h-14 sm:flex-nowrap sm:gap-x-6 lg:px-5">
        <a href={hrefFor('/', new URLSearchParams(bankQuery))} className="flex h-12 shrink-0 items-center gap-2.5 text-ink sm:h-auto">
          <LogoMark />
          <span className="text-[1.0625rem] font-extrabold tracking-[-0.015em] max-[360px]:sr-only">SAT Question Bank</span>
        </a>
        <ul className="order-last -mx-1 flex w-full min-w-0 gap-1 overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:pb-0">
          {LINKS.map((l) => {
            const active = isActive(l.path, path);
            return (
              <li key={l.path}>
                <a
                  href={l.path === '/' ? hrefFor('/', new URLSearchParams(bankQuery)) : hrefFor(l.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap rounded px-2.5 py-1.5 text-[0.9375rem] font-bold ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  <span className={active ? 'shadow-[inset_0_-0.5em_0_var(--c-marker)] dark:shadow-[inset_0_-0.18em_0_var(--c-marker)]' : ''}>{l.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {testName && (
            <a href={hrefFor('/test')} title={`Resume “${testName}”`} className={`${btn.hero} mr-2 !px-3 !py-1.5 !text-sm`}>
              Resume test
            </a>
          )}
          <div className="mr-1 flex items-center rounded-md border border-line-strong" role="group" aria-label="Text size">
            <button type="button" className={`${tool} !flex !h-8 !min-w-8 items-center justify-center gap-px rounded-r-none text-sm font-bold`} onClick={() => setScale(TEXT_SCALES[idx - 1])} disabled={idx <= 0} aria-label="Smaller text" title="Smaller text">A<span aria-hidden className="text-[0.7em]">−</span></button>
            <button type="button" className={`${tool} !flex !h-8 !min-w-8 items-center justify-center gap-px rounded-l-none border-l border-line-strong text-base font-bold`} onClick={() => setScale(TEXT_SCALES[idx + 1])} disabled={idx >= TEXT_SCALES.length - 1} aria-label="Larger text" title="Larger text">A<span aria-hidden className="text-[0.7em]">+</span></button>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={tool}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <HelpButton />
        </div>
      </nav>
    </header>
  );
}
