import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { addDays, shortDate, weekdayName, daysBetween } from './dates';
import { CUT_DAYS, FLAGS, PLAN_START, WEIGH_IN } from './plan';
import type { DayPlan } from './rules';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export const litres = (ml: number) => `${+(ml / 1000).toFixed(2)}`;

export interface DateNav {
  date: string;
  today: string;
  setDate: (d: string) => void;
}

function dayCaption(date: string) {
  if (date <= WEIGH_IN) return `Day ${daysBetween(PLAN_START, date) + 1} of ${CUT_DAYS}`;
  return 'After the cut';
}

export function DateBar({ date, today, setDate }: DateNav) {
  return (
    <header class="datebar">
      <div>
        <h1>{weekdayName(date)}</h1>
        <p class="meta">
          <span>
            {shortDate(date)} · {dayCaption(date)}
          </span>
          {date !== today && (
            <button type="button" class="textlink" onClick={() => setDate(today)}>
              Back to today
            </button>
          )}
        </p>
      </div>
      <div class="datebar-arrows">
        <button type="button" class="arrow" aria-label="Previous day" disabled={date <= PLAN_START} onClick={() => setDate(addDays(date, -1))}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button type="button" class="arrow" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </header>
  );
}

export function Tick() {
  return (
    <svg class="tick" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

interface CheckProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

// One tappable set or round, numbered until it's done.
export function SetBox({ checked, label, n, onChange }: CheckProps & { n: number }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} class={checked ? 'set set-on' : 'set'} onClick={() => onChange(!checked)}>
      {checked ? <Tick /> : n}
    </button>
  );
}

export function CheckRow({ checked, label, onChange }: CheckProps) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} class="flag" onClick={() => onChange(!checked)}>
      <span class={checked ? 'check-box check-on' : 'check-box'}>{checked && <Tick />}</span>
      <span class="flag-text">{label}</span>
    </button>
  );
}

export function Bar({ ratio, tone }: { ratio: number; tone?: 'food' | 'done' }) {
  return (
    <div class={tone ? `prog prog-${tone}` : 'prog'} aria-hidden="true">
      <i style={{ width: `${Math.min(1, ratio) * 100}%` }} />
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  unit?: string;
  decimal?: boolean;
  big?: boolean;
  hideLabel?: boolean;
  min?: number;
  max?: number;
}

// Keeps the typed text while editing, so "81." isn't rewritten mid-entry.
export function NumberField({ label, value, onCommit, unit, decimal, big, hideLabel, min = 0, max = 1_000_000 }: NumberFieldProps) {
  const [text, setText] = useState(value?.toString() ?? '');
  const [rejected, setRejected] = useState(false);

  const parse = (raw: string) => {
    const clean = decimal ? raw.trim().replace(',', '.') : raw.replace(/[,\s]/g, '');
    return clean === '' ? undefined : Number(clean);
  };
  const isValid = (n: number | undefined) => n === undefined || (Number.isFinite(n) && n >= min && n <= max);

  useEffect(() => {
    if (parse(text) !== value) setText(value?.toString() ?? '');
  }, [value]);

  return (
    <label class="field">
      <span class={hideLabel ? 'sr-only' : 'field-label'}>{label}</span>
      <span class={big ? 'inp inp-big' : 'inp'}>
        <input
          class="num"
          type="text"
          inputmode={decimal ? 'decimal' : 'numeric'}
          autocomplete="off"
          value={text}
          onInput={(e) => {
            const raw = e.currentTarget.value;
            const n = parse(raw);
            setText(raw);
            setRejected(false);
            if (isValid(n)) onCommit(n);
          }}
          onBlur={() => setRejected(!isValid(parse(text)))}
        />
        {unit && <span class="field-unit">{unit}</span>}
      </span>
      {rejected && <span class="field-error">Not saved. Check this number.</span>}
    </label>
  );
}

export function Note({ children }: { children: ComponentChildren }) {
  return <p class="note">{children}</p>;
}

export function SafetyBanners({ day }: { day: DayPlan }) {
  const advice = (id: string) => FLAGS.find((f) => f.id === id)!.advice;
  return (
    <>
      {day.emergency && (
        <p class="alert alert-urgent" role="alert">
          {advice('emergency')}
        </p>
      )}
      {day.dizzy && <p class="alert">{advice('dizzy')}</p>}
    </>
  );
}

export function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
}
