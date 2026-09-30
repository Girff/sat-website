import { lazy, Suspense, useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { useRoute } from './lib/router';
import BankPage from './pages/BankPage';
import { useData } from './store/data';
import { useSession } from './store/session';
import { submitTest, useTest } from './store/test';
import { useUi } from './store/ui';

// Routes other than the bank are code-split and load on first visit.
const BuildPage = lazy(() => import('./pages/BuildPage'));
const TestPage = lazy(() => import('./pages/TestPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PrintPage = lazy(() => import('./pages/PrintPage'));
const QuestionPopup = lazy(() => import('./components/QuestionPopup'));
// Dev-only: excluded from production builds by the static DEV check.
const QaPage = import.meta.env.DEV ? lazy(() => import('./pages/QaPage')) : null;

/** Warn before closing the tab with unexported results or a test in progress. */
function useLeaveWarning() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useSession.getState().dirty || useTest.getState().test) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}

/** Submit a countdown test at zero, whichever page is open. */
function useAutoSubmit() {
  const deadline = useTest((s) => s.test?.deadline ?? null);
  useEffect(() => {
    if (deadline === null) return;
    const t = window.setTimeout(() => { submitTest(true).catch(() => undefined); }, Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(t);
  }, [deadline]);
}

export default function App() {
  const { path } = useRoute();
  const load = useData((s) => s.load);
  const popupOpen = useUi((s) => s.popup !== null);
  const hasTest = useTest((s) => s.test !== null);
  useEffect(() => { void load(); }, [load]);
  useLeaveWarning();
  useAutoSubmit();

  let page;
  if (path === '/') page = <BankPage />;
  else if (path === '/build') page = <BuildPage />;
  else if (path === '/test') page = <TestPage />;
  else if (path.startsWith('/results/')) page = <ResultsPage />;
  else if (path === '/history') page = <HistoryPage />;
  else if (path === '/dashboard') page = <DashboardPage />;
  else if (path === '/print') page = <PrintPage />;
  else if (path === '/qa' && QaPage) page = <QaPage />;
  else page = <NotFound />;
  const inTest = path === '/test' && hasTest;

  return (
    <>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}
        className="sr-only z-50 rounded bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        Skip to content
      </a>
      {!inTest && <TopNav />}
      <main id="main" tabIndex={-1} className="outline-none">
        <Suspense fallback={<p className="p-8 text-center text-muted">Loading…</p>}>{page}</Suspense>
      </main>
      {popupOpen && <Suspense fallback={null}><QuestionPopup /></Suspense>}
    </>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <a href="#/" className="mt-4 inline-block text-accent underline">Go to the question bank</a>
    </div>
  );
}
