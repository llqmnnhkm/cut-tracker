import { useState } from 'preact/hooks';
import { CheckRow, DateBar, NumberField, fmt, litres, type DateNav } from '../components';
import { WEIGH_NOTE } from '../plan';
import { dayPlan, parseAmount, totals } from '../rules';
import { updateDay, type DayLog, type Meal, type Store } from '../store';
import { waterNote } from './TodayView';

function MealForm({ onAdd }: { onAdd: (meal: Meal) => void }) {
  const blank = { name: '', low: '', high: '', protein: '', carbs: '', fat: '' };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  const input = (key: keyof typeof blank, label: string, numeric = true) => (
    <label class="field">
      <span class="field-label">{label}</span>
      <span class="field-entry">
        <input
          class={numeric ? 'num' : ''}
          type="text"
          inputmode={numeric ? 'numeric' : 'text'}
          autocomplete="off"
          value={form[key]}
          onInput={(e) => setForm({ ...form, [key]: e.currentTarget.value })}
        />
      </span>
    </label>
  );

  const submit = (e: Event) => {
    e.preventDefault();
    const low = parseAmount(form.low);
    const high = parseAmount(form.high);
    const macros = [parseAmount(form.protein), parseAmount(form.carbs), parseAmount(form.fat)];
    if (low === undefined || !Number.isFinite(low) || low < 0) return setError('Enter the calories, or the low end of the range.');
    if (high !== undefined && (!Number.isFinite(high) || high < low)) return setError('The high end must be above the low end.');
    if (macros.some((m) => m !== undefined && (!Number.isFinite(m) || m < 0))) return setError('Protein, carbs and fat must be numbers.');
    onAdd({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name.trim() || 'Meal',
      kcal: low,
      ...(high !== undefined && high !== low ? { kcalHigh: high } : {}),
      protein: macros[0],
      carbs: macros[1],
      fat: macros[2],
    });
    setForm(blank);
    setError('');
  };

  return (
    <form class="meal-form" onSubmit={submit}>
      {input('name', 'Meal', false)}
      <div class="grid-2">
        {input('low', 'Kcal')}
        {input('high', 'Up to (optional)')}
      </div>
      <div class="grid-3">
        {input('protein', 'Protein g')}
        {input('carbs', 'Carbs g')}
        {input('fat', 'Fat g')}
      </div>
      {error && <p class="field-error">{error}</p>}
      <button class="button" type="submit">
        Add meal
      </button>
    </form>
  );
}

const macroLine = (m: Meal) =>
  [m.protein !== undefined && `P ${m.protein}`, m.carbs !== undefined && `C ${m.carbs}`, m.fat !== undefined && `F ${m.fat}`]
    .filter(Boolean)
    .join(' · ');

export function LogView({ store, date, today, setDate }: DateNav & { store: Store }) {
  const log: DayLog = store.days[date] ?? {};
  const day = dayPlan(store, date);
  const sum = totals(log);
  const water = log.waterMl ?? 0;
  const note = waterNote(date);
  const change = (patch: Partial<DayLog>) => updateDay(date, (d) => ({ ...d, ...patch }));
  const addWater = (ml: number) => change({ waterMl: Math.max(0, water + ml) });

  return (
    <>
      <DateBar date={date} today={today} setDate={setDate} />

      <section class="block" key={date}>
        <h2>Morning weight</h2>
        <NumberField label="Weight" unit="kg" decimal min={30} max={250} value={log.weight} onCommit={(weight) => change({ weight })} />
        <p class="muted-text">{WEIGH_NOTE}</p>
      </section>

      <section class="block" key={`${date}-steps`}>
        <h2>Steps</h2>
        <NumberField label="Total so far, from Apple Fitness" max={200000} value={log.steps} onCommit={(steps) => change({ steps })} />
        {day.steps !== null && <p class="muted-text">Target today: {fmt(day.steps)}.</p>}
      </section>

      <section class="block">
        <h2>Water</h2>
        <p class="num big-value">{litres(water)} L</p>
        {note && <p class="muted-text">{note}</p>}
        <div class="button-row">
          <button class="button" type="button" onClick={() => addWater(250)}>+250 ml</button>
          <button class="button" type="button" onClick={() => addWater(500)}>+500 ml</button>
          <button class="button button-quiet" type="button" disabled={water === 0} onClick={() => addWater(-250)}>−250 ml</button>
        </div>
      </section>

      <section class="block">
        <h2>Food</h2>
        <ul class="meals">
          {(log.meals ?? []).map((m) => (
            <li class="meal" key={m.id}>
              <div class="meal-main">
                <span>{m.name}</span>
                <span class="num meal-macros">{macroLine(m)}</span>
              </div>
              <span class="num">{m.kcalHigh !== undefined ? `${fmt(m.kcal)}–${fmt(m.kcalHigh)}` : fmt(m.kcal)}</span>
              <button
                class="textlink"
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() => change({ meals: log.meals!.filter((x) => x.id !== m.id) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {(log.meals?.length ?? 0) > 0 && (
          <p class="num meal-total">
            Total {fmt(sum.kcal)} kcal · P {fmt(sum.protein)} · C {fmt(sum.carbs)} · F {fmt(sum.fat)}
          </p>
        )}
        <MealForm onAdd={(meal) => change({ meals: [...(log.meals ?? []), meal] })} />
      </section>

      <section class="block">
        <h2>Workout</h2>
        <CheckRow checked={!!log.workoutDone} label="Workout done" onChange={(workoutDone) => change({ workoutDone })} />
      </section>
    </>
  );
}
