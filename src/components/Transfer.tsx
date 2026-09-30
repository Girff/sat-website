// Export results to a JSON file / import them back. Nothing else leaves memory.
import { useRef, useState } from 'react';
import { downloadJson, exportFileName, makeExport, mergeImport, parseImport } from '../lib/transfer';
import { useData } from '../store/data';
import { useSession } from '../store/session';
import { btn } from './Dialog';

const MAX_BYTES = 20 * 1024 * 1024;

export function TransferControls() {
  const status = useSession((s) => s.status);
  const history = useSession((s) => s.history);
  const dirty = useSession((s) => s.dirty);
  const byId = useData((s) => s.byId);
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const hasData = history.length > 0 || Object.keys(status).length > 0;

  const doExport = () => {
    downloadJson(makeExport(status, history), exportFileName());
    useSession.getState().markExported();
    setMessage({ ok: true, text: 'Results exported. Import the file in a later session to restore them.' });
  };

  const doImport = async (file: File) => {
    setMessage(null);
    try {
      if (file.size > MAX_BYTES) throw new Error('That file is too large to be a results file.');
      const imp = parseImport(await file.text(), new Set(byId.keys()));
      const s = useSession.getState();
      const merged = mergeImport(s.status, s.history, imp);
      s.replaceResults(merged.status, merged.history);
      const statuses = Object.keys(imp.status).length;
      setMessage({
        ok: true,
        text: `Imported ${merged.added} set${merged.added === 1 ? '' : 's'} and ${statuses} question status${statuses === 1 ? '' : 'es'}`
          + `${imp.history.length > merged.added ? ` (${imp.history.length - merged.added} already here)` : ''}`
          + `${imp.skipped ? `; skipped ${imp.skipped} unreadable set${imp.skipped === 1 ? '' : 's'}` : ''}.`,
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" className={btn.secondary} onClick={doExport} disabled={!hasData}>
        Export results{dirty && <span className="rounded-full bg-medium-soft px-1.5 text-xs text-medium">unsaved</span>}
      </button>
      <button type="button" className={btn.secondary} onClick={() => input.current?.click()} disabled={!byId.size}>Import results</button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void doImport(f);
        }}
      />
      <p role="status" className={`basis-full text-sm ${message?.ok === false ? 'text-hard' : 'text-muted'}`}>{message?.text}</p>
    </div>
  );
}
