// Starting a set while another is in progress asks first (only one test runs at a time).
import { useState } from 'react';
import { hrefFor } from '../lib/router';
import type { SetConfig } from '../lib/sets';
import type { IndexEntry } from '../lib/types';
import { startTest, useTest } from '../store/test';
import { Dialog, btn } from './Dialog';

export function useStartTest() {
  const active = useTest((s) => s.test);
  const [pending, setPending] = useState<{ entries: IndexEntry[]; config: SetConfig } | null>(null);
  const start = (entries: IndexEntry[], config: SetConfig) => {
    if (useTest.getState().test) setPending({ entries, config });
    else startTest(entries, config);
  };
  const dialog = (
    <Dialog
      open={pending !== null}
      onClose={() => setPending(null)}
      title="Replace the test in progress?"
      footer={(
        <>
          <button type="button" className={btn.secondary} onClick={() => setPending(null)}>Cancel</button>
          <a href={hrefFor('/test')} className={btn.secondary} onClick={() => setPending(null)}>Resume current test</a>
          <button type="button" className={btn.danger} onClick={() => { if (pending) startTest(pending.entries, pending.config); setPending(null); }}>
            Discard it and start
          </button>
        </>
      )}
    >
      <p className="px-5 py-4 text-sm"><strong>{active?.name}</strong> hasn’t been submitted. Starting a new set discards its answers.</p>
    </Dialog>
  );
  return { start, dialog };
}
