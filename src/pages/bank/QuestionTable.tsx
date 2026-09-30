import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { DifficultyBadge, StatusBadges } from '../../components/Badges';
import { IconArrowDown, IconArrowUp, IconSort } from '../../components/Icons';
import type { QStatus } from '../../lib/filters';
import type { Difficulty, IndexEntry } from '../../lib/types';
import { useSession } from '../../store/session';
import { useUi } from '../../store/ui';

const LEVEL: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
const statusRank = (s: QStatus | undefined) => (s?.result === 'incorrect' ? 3 : s?.result === 'correct' ? 2 : 0) + (s?.flagged ? 1 : 0);
const ROW_REM = 2.75;

interface Props {
  rows: IndexEntry[];
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  showSection: boolean;
  onOpen: (id: string, order: string[]) => void;
  labelledBy?: string;
}

/** Column widths (CSS grid tracks) and the container widths at which they appear. */
const TRACKS: Record<string, { track: string; minWidth: number }> = {
  select: { track: '2.75rem', minWidth: 0 },
  id: { track: '7rem', minWidth: 0 },
  section: { track: '5.75rem', minWidth: 900 },
  domain: { track: 'minmax(9rem,1fr)', minWidth: 760 },
  skill: { track: 'minmax(10rem,1.3fr)', minWidth: 0 },
  difficulty: { track: '7rem', minWidth: 0 },
  type: { track: '5.5rem', minWidth: 1000 },
  preview: { track: 'minmax(12rem,2fr)', minWidth: 1100 },
  status: { track: '7.5rem', minWidth: 560 },
};
/** Narrow screens (phones): tighter tracks so ID, skill and difficulty fit. */
const COMPACT: Record<string, string> = { select: '2.25rem', id: '5.5rem', skill: 'minmax(5rem,1fr)', difficulty: '6rem' };

export function QuestionTable({ rows, sorting, onSortingChange, showSection, onOpen, labelledBy }: Props) {
  const status = useSession((s) => s.status);
  const selected = useSession((s) => s.selected);
  const toggleSelected = useSession((s) => s.toggleSelected);
  const setSelected = useSession((s) => s.setSelected);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [active, setActive] = useState(0);
  const lastChecked = useRef<number | null>(null);
  const textScale = useSession((s) => s.textScale);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo<ColumnDef<IndexEntry>[]>(() => [
    { id: 'select', header: 'Select', enableSorting: false, cell: () => null },
    { id: 'id', accessorKey: 'id', header: 'Question ID', sortingFn: 'text', cell: (c) => <span className="font-mono text-[0.8rem]">{c.getValue<string>()}</span> },
    { id: 'section', accessorFn: (r) => (r.section === 'math' ? 'Math' : 'R&W'), header: 'Section', sortingFn: 'text' },
    { id: 'domain', accessorKey: 'domain', header: 'Domain', sortingFn: 'text' },
    { id: 'skill', accessorKey: 'skill', header: 'Skill', sortingFn: 'text' },
    {
      id: 'difficulty', accessorKey: 'difficulty', header: 'Difficulty',
      sortingFn: (a, b) => LEVEL[a.original.difficulty] - LEVEL[b.original.difficulty],
      cell: (c) => <DifficultyBadge value={c.getValue<Difficulty>()} />,
    },
    { id: 'type', accessorFn: (r) => (r.type === 'mcq' ? 'MCQ' : 'Grid-in'), header: 'Type', sortingFn: 'text' },
    { id: 'preview', accessorKey: 'preview', header: 'Preview', enableSorting: false },
    {
      id: 'status', accessorFn: (r) => statusRank(status[r.id]), header: 'Status',
      cell: (c) => <StatusBadges status={status[c.row.original.id]} />,
    },
  ], [status]);

  const columnVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const [id, t] of Object.entries(TRACKS)) v[id] = width >= t.minWidth * textScale;
    v.section = v.section && showSection;
    return v;
  }, [width, showSection, textScale]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: (u) => onSortingChange(typeof u === 'function' ? u(sorting) : u),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    enableSortingRemoval: true,
    sortDescFirst: false,
    getRowId: (r) => r.id,
  });

  const model = table.getRowModel().rows;
  const order = useMemo(() => model.map((r) => r.original.id), [model]);
  const visible = table.getVisibleLeafColumns();
  const compact = width < 520 * textScale;
  const grid = visible.map((c) => (compact && COMPACT[c.id]) || TRACKS[c.id].track).join(' ');
  const rowPx = ROW_REM * 16 * textScale;

  const virt = useVirtualizer({
    count: model.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowPx,
    overscan: 12,
  });
  useEffect(() => { virt.measure(); }, [rowPx, virt]);
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, model.length - 1))); }, [model.length]);

  const allSelected = order.length > 0 && order.every((id) => selected.has(id));
  const someSelected = !allSelected && order.some((id) => selected.has(id));
  const headerBox = useRef<HTMLInputElement>(null);
  useEffect(() => { if (headerBox.current) headerBox.current.indeterminate = someSelected; }, [someSelected]);

  const focusRow = (i: number) => {
    const n = Math.max(0, Math.min(model.length - 1, i));
    setActive(n);
    virt.scrollToIndex(n, { align: 'auto' });
    requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-row="${n}"]`)?.focus());
  };

  // after the popup closes, put focus on the row of the question it was showing
  const returnTo = useUi((s) => s.returnTo);
  useEffect(() => {
    if (!returnTo) return;
    const i = order.indexOf(returnTo);
    if (i >= 0) focusRow(i);
    useUi.setState({ returnTo: null });
  }, [returnTo]);

  const onRowKey = (e: KeyboardEvent, i: number) => {
    const page = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / rowPx) - 1);
    const moves: Record<string, number> = { ArrowDown: i + 1, ArrowUp: i - 1, PageDown: i + page, PageUp: i - page, Home: 0, End: model.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      focusRow(moves[e.key]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onOpen(order[i], order);
    } else if (e.key === ' ' || e.key === 'x') {
      e.preventDefault();
      toggleSelected(order[i]);
    }
  };

  const onCheck = (e: MouseEvent, i: number) => {
    e.stopPropagation();
    if (e.shiftKey && lastChecked.current !== null) {
      const [a, b] = [lastChecked.current, i].sort((x, y) => x - y);
      setSelected(order.slice(a, b + 1), !selected.has(order[i]));
    } else {
      toggleSelected(order[i]);
    }
    lastChecked.current = i;
  };

  return (
    <div
      ref={scrollRef}
      role="table"
      aria-labelledby={labelledBy}
      aria-rowcount={model.length + 1}
      className="h-full overflow-auto rounded-lg border border-line bg-surface"
    >
      <div role="rowgroup" className="sticky top-0 z-10 border-b border-line bg-surface-2">
        <div role="row" aria-rowindex={1} className="grid items-center text-left text-xs font-semibold text-muted" style={{ gridTemplateColumns: grid }}>
          {table.getFlatHeaders().filter((h) => h.column.getIsVisible()).map((h) => {
            if (h.id === 'select') {
              return (
                <div role="columnheader" key={h.id} className="flex justify-center px-2 py-2">
                  <input
                    ref={headerBox}
                    type="checkbox"
                    className="size-4 accent-[var(--c-accent)]"
                    checked={allSelected}
                    onChange={() => setSelected(order, !allSelected)}
                    aria-label={allSelected ? 'Deselect all matching questions' : `Select all ${order.length.toLocaleString()} matching questions`}
                    disabled={!order.length}
                  />
                </div>
              );
            }
            const sorted = h.column.getIsSorted();
            const sortIndex = sorting.length > 1 ? h.column.getSortIndex() : -1;
            return (
              <div
                role="columnheader"
                key={h.id}
                aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : h.column.getCanSort() ? 'none' : undefined}
                className="min-w-0 px-2 py-2"
              >
                {h.column.getCanSort() ? (
                  <button
                    type="button"
                    onClick={h.column.getToggleSortingHandler()}
                    title="Sort. Shift-click to add a secondary sort."
                    className={`inline-flex max-w-full items-center gap-1 rounded hover:text-ink ${sorted ? 'text-accent' : ''}`}
                  >
                    <span className="truncate">{compact && h.id === 'id' ? 'ID' : flexRender(h.column.columnDef.header, h.getContext())}</span>
                    {sorted === 'asc' ? <IconArrowUp width={14} height={14} /> : sorted === 'desc' ? <IconArrowDown width={14} height={14} /> : <IconSort width={14} height={14} className="opacity-40" />}
                    {sortIndex >= 0 && <span className="text-[0.65rem] tabular-nums">{sortIndex + 1}</span>}
                  </button>
                ) : (
                  <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div role="rowgroup" className="relative" style={{ height: virt.getTotalSize() }}>
        {virt.getVirtualItems().map((vi) => {
          const row = model[vi.index];
          const id = row.original.id;
          const isSel = selected.has(id);
          return (
            <div
              key={id}
              role="row"
              data-row={vi.index}
              aria-rowindex={vi.index + 2}
              aria-selected={isSel}
              tabIndex={vi.index === active ? 0 : -1}
              onFocus={() => setActive(vi.index)}
              onClick={() => onOpen(id, order)}
              onKeyDown={(e) => onRowKey(e, vi.index)}
              className={`absolute left-0 top-0 grid w-full cursor-pointer items-center border-b border-line text-sm hover:bg-surface-2 focus-visible:-outline-offset-2 ${isSel ? 'bg-accent-soft/60' : ''}`}
              style={{ gridTemplateColumns: grid, height: vi.size, transform: `translateY(${vi.start}px)` }}
            >
              {row.getVisibleCells().map((cell) => {
                if (cell.column.id === 'select') {
                  return (
                    <div role="cell" key={cell.id} className="flex justify-center px-2" onClick={(e) => onCheck(e, vi.index)}>
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        className="size-4 accent-[var(--c-accent)]"
                        checked={isSel}
                        readOnly
                        aria-label={`Select question ${id}`}
                      />
                    </div>
                  );
                }
                const text = cell.column.id === 'preview' || cell.column.id === 'skill' || cell.column.id === 'domain';
                return (
                  <div
                    role="cell"
                    key={cell.id}
                    className={`min-w-0 px-2 ${text ? 'truncate' : ''} ${cell.column.id === 'preview' ? 'text-muted' : ''}`}
                    title={text ? String(cell.getValue() ?? '') : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell ?? ((c) => String(c.getValue() ?? '')), cell.getContext())}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
