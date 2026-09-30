// Problem-set options: name, Check Answer, timer, order, choice shuffling, grouping.
import { Segmented } from '../../components/Segmented';
import { formatClock } from '../../lib/scoring';
import { hasBothSections, pacedSeconds, type SetConfig, type TimerMode } from '../../lib/sets';
import type { IndexEntry } from '../../lib/types';

interface Props {
  config: SetConfig;
  onChange: (patch: Partial<SetConfig>) => void;
  entries: IndexEntry[];
  autoName: string;
  /** Generated sets are already in random order. */
  showOrder: boolean;
}

export function SetOptions({ config, onChange, entries, autoName, showOrder }: Props) {
  const paced = pacedSeconds(entries);
  const reading = entries.filter((e) => e.section === 'reading').length;
  const math = entries.length - reading;
  const pace = [reading && `${reading} × 71 s`, math && `${math} × 95 s`].filter(Boolean).join(' + ');
  return (
    <div className="grid gap-5">
      <div>
        <label htmlFor="set-name" className="mb-1.5 block text-sm font-semibold">Name</label>
        <input
          id="set-name"
          value={config.name}
          placeholder={autoName}
          maxLength={80}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-muted focus:border-accent"
        />
        <p className="mt-1 text-xs text-muted">Leave blank to use “{autoName}”.</p>
      </div>

      <Segmented
        legend="Check Answer button during the test"
        value={config.checkAnswer ? 'on' : 'off'}
        onChange={(v) => onChange({ checkAnswer: v === 'on' })}
        options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
        description={config.checkAnswer
          ? 'Practice mode: check each question as you go. Answers stay hidden until you ask.'
          : 'Like the real test: no feedback until you submit.'}
      />

      <div>
        <Segmented<TimerMode>
          legend="Timer"
          value={config.timer}
          onChange={(timer) => onChange({ timer })}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'stopwatch', label: 'Stopwatch' },
            { value: 'countdown', label: 'SAT pace', hint: 'Countdown using official SAT pacing' },
            { value: 'custom', label: 'Custom' },
          ]}
          description={
            config.timer === 'countdown' ? <>Countdown of <strong className="text-ink">{formatClock(paced * 1000)}</strong>{pace && ` (${pace})`}. Submits automatically at zero.</>
              : config.timer === 'stopwatch' ? 'Counts up from zero.'
                : config.timer === 'off' ? 'No clock. Time per question is still recorded.'
                  : 'Countdown of your choice. Submits automatically at zero.'
          }
        />
        {config.timer === 'custom' && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="number"
              min={1}
              max={600}
              value={config.customMinutes}
              onChange={(e) => onChange({ customMinutes: Math.min(600, Math.max(1, Number(e.target.value) || 1)) })}
              className="h-9 w-24 rounded-md border border-line-strong bg-surface px-2 text-right tabular-nums"
            />
            minutes total
          </label>
        )}
      </div>

      {showOrder && (
        <Segmented
          legend="Question order"
          value={config.order}
          onChange={(order) => onChange({ order })}
          options={[{ value: 'selected', label: 'As selected' }, { value: 'shuffled', label: 'Shuffled' }]}
        />
      )}

      <Segmented
        legend="Shuffle answer choices"
        value={config.shuffleChoices ? 'on' : 'off'}
        onChange={(v) => onChange({ shuffleChoices: v === 'on' })}
        options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
        description={config.shuffleChoices ? 'Explanations are relabelled to match the letters you see.' : undefined}
      />

      {hasBothSections(entries) && (
        <Segmented
          legend="Sections"
          value={config.grouping}
          onChange={(grouping) => onChange({ grouping })}
          options={[{ value: 'grouped', label: 'Reading & Writing, then Math' }, { value: 'mixed', label: 'Mixed' }]}
        />
      )}
    </div>
  );
}
