// Answer visibility rules (§5): hidden by default, revealed per question by
// Check Answer, and hidden again after Next/Previous.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexEntry, Question } from '../lib/types';
import { useData } from '../store/data';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import QuestionPopup from './QuestionPopup';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry = (id: string): IndexEntry => ({
  id, section: 'math', domain: 'Algebra', skill: 'Linear equations in one variable', difficulty: 'Easy', type: 'mcq', preview: '', chunk: 'test-chunk', low: false,
});
const question = (id: string): Question => ({
  ...entry(id), stem: [{ kind: 'text', value: `Stem ${id}` }],
  choices: (['A', 'B', 'C', 'D'] as const).map((l) => ({ label: l, content: [{ kind: 'text', value: `${id} choice ${l}` }] })),
  correct: ['B'],
  rationale: { overall: [{ kind: 'text', value: 'Choice B is correct.' }] },
  figures: [], sourcePdf: 'x.pdf', sourcePage: 1, parseConfidence: 'high',
});

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const reveal = () => host.ownerDocument.querySelector('[aria-label="Answer and explanation"]');
const button = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;
const radios = () => [...document.querySelectorAll('[role="radio"]')];

beforeEach(async () => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  Element.prototype.scrollIntoView ??= () => undefined;   // not implemented by jsdom
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([question('q1'), question('q2')]))));
  const entries = [entry('q1'), entry('q2')];
  useData.setState({ entries, byId: new Map(entries.map((e) => [e.id, e])), status: 'ready' });
  useUi.setState({ popup: { id: 'q1', order: ['q1', 'q2'] } });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<QuestionPopup />));
  await flush();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('question popup', () => {
  it('hides the answer until Check Answer, for this question only', async () => {
    expect(document.body.textContent).toContain('Stem q1');
    expect(reveal()).toBeNull();

    await act(async () => { (radios()[2] as HTMLElement).click(); });
    expect(radios()[2].getAttribute('aria-checked')).toBe('true');
    expect(reveal()).toBeNull();

    await act(async () => { button('Check Answer').click(); });
    expect(reveal()?.textContent).toContain('Incorrect');
    expect(reveal()?.textContent).toContain('Correct answer: B');
    expect(useSession.getState().status.q1?.result).toBe('incorrect');

    await act(async () => { button('Next').click(); });
    await flush();
    expect(document.body.textContent).toContain('Stem q2');
    expect(reveal()).toBeNull();
    expect(radios().every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);

    await act(async () => { button('Previous').click(); });
    await flush();
    expect(document.body.textContent).toContain('Stem q1');
    expect(reveal()).toBeNull();
  });

  it('can reveal without choosing an answer, and supports keyboard shortcuts', async () => {
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true })); });
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(reveal()?.textContent).toContain('Correct');

    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    await flush();
    expect(reveal()).toBeNull();
    await act(async () => { button('Check Answer').click(); });
    expect(reveal()?.textContent).toContain('No answer given');
  });
});
