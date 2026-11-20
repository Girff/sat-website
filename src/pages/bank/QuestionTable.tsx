import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { DifficultyBadge, StatusBubble } from '../../components/Badges';
import { IconArrowDown, IconArrowUp, IconSort } from '../../components/Icons';
import type { QStatus } from '../../lib/filters';
import type { Difficulty, IndexEntry } from '../../lib/types';
import { useSession } from '../../store/session';
import { useUi } from '../../store/ui';

const LEVEL: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
const statusRank = (s: QStatus | undefined) => (s?.result === 'incorrect' ? 3 : s?.result === 'correct' ? 2 : 0) + (s?.flagged ? 1 : 0);
const ROW_REM = 3.6;

interface Props {
  rows: IndexEntry[];
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  onOpen: (id: string, order: string[]) => void;
  labelledBy?: string;
}

/** Column widths (CSS grid tracks) and the container widths at which they appear. */
const TRACKS: Record<string, { track: string; minWidth: number }> = {
  select: { track: '2.75rem', minWidth: 0 },
  status: { track: '3.25rem', minWidth: 0 },
  skill: { track: 'minmax(0,1fr)', minWidth: 0 },
  difficulty: { track: '7.25rem', minWidth: 0 },
  type: { track: '8.5rem', minWidth: 760 },
  id: { track: '6.5rem', minWidth: 600 },
};
/** Narrow screens (phones): the difficulty column shows only its meter. */
const COMPACT: Record<string, string> = { select: '2.5rem', status: '2.75rem', difficulty: '3rem' };

export function QuestionTable({ rows, sorting, onSortingChange, onOpen, labelledBy }: Props) {
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

  const compact = width < 520 * textScale;
  const columns = useMemo<ColumnDef<IndexEntry>[]>(() => [
    { id: 'select', header: 'Select', enableSorting: false, cell: () => null },
    {
      id: 'status', accessorFn: (r) => statusRank(status[r.id]), header: 'Status',
      cell: (c) => <StatusBubble status={status[c.row.original.id]} />,
    },
    {
      id: 'skill', accessorKey: 'skill', header: 'Question', sortingFn: 'text',
      cell: (c) => {
        const e = c.row.original;
        return (
          <>
            <span className="block truncate text-[0.9375rem]">{e.preview || `Question ${e.id}`}</span>
            <span className="block truncate text-[0.8125rem] text-muted">{e.skill}</span>
          </>
        );
      },
    },
    {
      id: 'difficulty', accessorKey: 'difficulty', header: 'Difficulty',
      sortingFn: (a, b) => LEVEL[a.original.difficulty] - LEVEL[b.original.difficulty],
      cell: (c) => <DifficultyBadge value={c.getValue<Difficulty>()} compact={compact} />,
    },
    { id: 'type', accessorFn: (r) => (r.type === 'mcq' ? 'Multiple choice' : 'Grid-in'), header: 'Type', sortingFn: 'text',
      cell: (c) => <span className="text-sm">{c.getValue<string>()}</span> },
    { id: 'id', accessorKey: 'id', header: 'ID', sortingFn: 'text', cell: (c) => <span className="text-[0.8125rem] text-muted">{c.getValue<string>()}</span> },
  ], [status, compact]);

  const columnVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const [id, t] of Object.entries(TRACKS)) v[id] = width >= t.minWidth * textScale;
    return v;
  }, [width, textScale]);

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
      className="h-full overflow-auto rounded-md border border-line-strong bg-surface"
    >
      <div role="rowgroup" className="sticky top-0 z-10 border-b border-line-strong bg-surface-2">
        <div role="row" aria-rowindex={1} className="grid items-center text-left text-[0.8125rem] font-bold text-muted" style={{ gridTemplateColumns: grid }}>
          {table.getFlatHeaders().filter((h) => h.column.getIsVisible()).map((h) => {
            if (h.id === 'select') {
              return (
                <div role="columnheader" key={h.id} className="flex justify-center px-2 py-2">
                  <input
                    ref={headerBox}
                    type="checkbox"
                    className="check"
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
                    className={`inline-flex max-w-full items-center gap-1 rounded hover:text-ink ${sorted ? 'text-ink' : ''}`}
                  >
                    <span className={`truncate ${sorted ? 'shadow-[inset_0_-0.45em_0_var(--c-marker)] dark:shadow-none' : ''}`}>
                      {(compact && h.id === 'difficulty') || h.id === 'status' ? <span className="sr-only">{h.id === 'status' ? 'Status' : 'Difficulty'}</span> : flexRender(h.column.columnDef.header, h.getContext())}
                    </span>
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
              className={`absolute left-0 top-0 grid w-full cursor-pointer items-center border-b border-line text-sm focus-visible:-outline-offset-2 ${isSel ? 'bg-marker-soft hover:brightness-[0.98]' : 'hover:bg-surface-2'}`}
              style={{ gridTemplateColumns: grid, height: vi.size, transform: `translateY(${vi.start}px)` }}
            >
              {row.getVisibleCells().map((cell) => {
                if (cell.column.id === 'select') {
                  return (
                    <div role="cell" key={cell.id} className="flex justify-center px-2" onClick={(e) => onCheck(e, vi.index)}>
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        className="check"
                        checked={isSel}
                        readOnly
                        aria-label={`Select question ${id}`}
                      />
                    </div>
                  );
                }
                const question = cell.column.id === 'skill';
                return (
                  <div
                    role="cell"
                    key={cell.id}
                    className={`min-w-0 px-2 ${cell.column.id === 'status' ? 'flex justify-center' : ''}`}
                    title={question ? row.original.preview : undefined}
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
