import { useState } from 'preact/hooks';
import { Note, Tick } from '../components';
import { addDays, daysBetween, localToday, shortDate } from '../dates';
import {
  ABOVE_ANY_CHECKPOINT_NOTE,
  CHECKPOINTS,
  DECISION_DATE,
  DECISION_NOTE,
  PLAN_START,
  REBOUND_NOTE,
  SWING_NOTE,
  WEIGH_IN,
  WEIGH_NOTE,
} from '../plan';
import { isAboveDecisionLimit, showRebound, weightSeries, type WeightPoint } from '../rules';
import type { Store } from '../store';

const W = 340;
const H = 230;
const M = { top: 10, right: 12, bottom: 24, left: 30 };

function Chart({ points }: { points: WeightPoint[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const lastLogged = points[points.length - 1]?.date ?? PLAN_START;
  const end = lastLogged > WEIGH_IN ? lastLogged : WEIGH_IN;
  const span = daysBetween(PLAN_START, end);
  const values = [...points.map((p) => p.weight), ...CHECKPOINTS.map((c) => c.target), 82];
  const low = Math.floor(Math.min(...values) - 0.5);
  const high = Math.ceil(Math.max(...values) + 0.5);

  const x = (date: string) => M.left + (daysBetween(PLAN_START, date) / span) * (W - M.left - M.right);
  const y = (kg: number) => M.top + ((high - kg) / (high - low)) * (H - M.top - M.bottom);

  const yTicks = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  const every = Math.max(2, Math.ceil(span / 6));
  const xTicks = Array.from({ length: Math.floor(span / every) + 1 }, (_, i) => addDays(PLAN_START, i * every));

  const active = points.find((p) => p.date === selected) ?? points[points.length - 1];

  const pick = (e: PointerEvent) => {
    if (!points.length) return;
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const nearest = points.reduce((a, b) => (Math.abs(x(b.date) - px) < Math.abs(x(a.date) - px) ? b : a));
    setSelected(nearest.date);
  };

  return (
    <figure class="chart">
      <p class="num chart-readout" aria-live="polite">
        {active ? (
          <>
            <strong>{active.weight.toFixed(1)} kg</strong> <span class="muted">{shortDate(active.date)} · trend {active.trend.toFixed(1)}</span>
          </>
        ) : (
          <span class="muted">No weight logged yet</span>
        )}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Morning weight and five-day trend against the checkpoints. The same values are in the table below."
        onPointerDown={pick}
        onPointerMove={pick}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line class="grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text class="axis" x={M.left - 6} y={y(t) + 4} text-anchor="end">{t}</text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} class="axis" x={x(d)} y={H - 6} text-anchor="middle">{shortDate(d).split(' ')[0]}</text>
        ))}
        {active && <line class="crosshair" x1={x(active.date)} x2={x(active.date)} y1={M.top} y2={H - M.bottom} />}
        {CHECKPOINTS.map((c) => (
          <rect key={c.date} class="checkpoint" x={x(c.date) - 4.5} y={y(c.target) - 4.5} width="9" height="9" />
        ))}
        {points.length > 1 && (
          <polyline class="trend" points={points.map((p) => `${x(p.date)},${y(p.trend)}`).join(' ')} />
        )}
        {points.map((p) => (
          <circle key={p.date} class="dot" cx={x(p.date)} cy={y(p.weight)} r="4" />
        ))}
      </svg>
      <figcaption class="legend">
        <span><svg viewBox="0 0 12 12" aria-hidden="true"><circle class="dot" cx="6" cy="6" r="4" /></svg> Logged</span>
        <span><svg viewBox="0 0 16 12" aria-hidden="true"><line class="trend" x1="1" x2="15" y1="6" y2="6" /></svg> 5-day trend</span>
        <span><svg viewBox="0 0 12 12" aria-hidden="true"><rect class="checkpoint" x="1.5" y="1.5" width="9" height="9" /></svg> Checkpoint</span>
      </figcaption>
    </figure>
  );
}

export function WeightView({ store }: { store: Store }) {
  const points = weightSeries(store);
  const today = localToday();
  const latest = points[points.length - 1];
  const onDate = (d: string) => store.days[d]?.weight;

  return (
    <>
      <header class="datebar">
        <div>
          <h1>Weight</h1>
          <p class="num meta">82 → 78 kg by {shortDate(WEIGH_IN)}</p>
        </div>
      </header>

      <div class="stats">
        <div>
          <span class="label">Latest</span>
          <span class="num stat">{latest ? latest.weight.toFixed(1) : '–'}</span>
        </div>
        <div>
          <span class="label">Trend</span>
          <span class="num stat">{latest ? latest.trend.toFixed(1) : '–'}</span>
        </div>
      </div>

      <Chart points={points} />
      <Note>{SWING_NOTE}</Note>

      {isAboveDecisionLimit(store) && today >= DECISION_DATE && today <= WEIGH_IN && <Note>{DECISION_NOTE}</Note>}
      {showRebound(today) && <Note>{REBOUND_NOTE}</Note>}

      <section class="block">
        <h2>Checkpoints</h2>
        <table class="table">
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Target</th><th scope="col">Logged</th></tr>
          </thead>
          <tbody>
            {CHECKPOINTS.map((c) => {
              const w = onDate(c.date);
              const met = w !== undefined && w <= c.target;
              return (
                <tr key={c.date}>
                  <td>{shortDate(c.date)}</td>
                  <td class="num">≤ {c.target.toFixed(1)}</td>
                  <td class="num">
                    {w !== undefined ? w.toFixed(1) : '–'} {met && <Tick />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {CHECKPOINTS.some((c) => c.date !== WEIGH_IN && (onDate(c.date) ?? 0) > c.target) && (
          <p class="muted-text">{ABOVE_ANY_CHECKPOINT_NOTE}</p>
        )}
      </section>

      <section class="block">
        <h2>All entries</h2>
        <p class="muted-text">{WEIGH_NOTE}</p>
        {points.length === 0 ? (
          <p>Nothing yet. Add this morning's weight in the Log.</p>
        ) : (
          <table class="table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Weight</th><th scope="col">Trend</th></tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{shortDate(p.date)}</td>
                  <td class="num">{p.weight.toFixed(1)}</td>
                  <td class="num">{p.trend.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
