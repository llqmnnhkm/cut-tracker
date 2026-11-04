// Builds the checklist for a day's session, including the modified versions.

import { FINISHER_NOTE, INTERVALS_NOTE, PROGRESSION_NOTE, SESSION_NAMES, STRENGTH_NOTE, WORKOUTS } from './plan';
import type { DayPlan } from './rules';

export interface Phase {
  label: string;
  seconds: number;
  work?: boolean; // shown in red, the effort part
  box?: number; // the box this phase ticks when it ends
  round?: string;
}

export interface TimerSpec {
  box: Phase[]; // one box's worth of timing
  gap?: Phase; // between boxes, never after the last
  once?: boolean; // times one box per start, for sets that already use the rest timer
}

export interface CheckItem {
  id: string;
  name: string;
  detail: string;
  boxes: number;
  easier?: string;
  rest?: boolean; // ticking a box starts the rest timer
  timer?: TimerSpec;
}

export interface CheckGroup {
  title: string;
  note?: string;
  items: CheckItem[];
}

export interface Checklist {
  groups: CheckGroup[];
  message?: string;
  finisherSkipped: boolean;
  footnote?: string;
}

const minutes = (label: string, min: number): TimerSpec => ({ box: [{ label, seconds: min * 60, work: true }] });

// Timers for the exercises measured in time rather than reps.
const SET_TIMERS: Record<string, TimerSpec> = {
  plank: { box: [{ label: 'Plank', seconds: 40, work: true }], once: true },
  'side-plank': {
    box: [
      { label: 'Side plank, left', seconds: 30, work: true },
      { label: 'Side plank, right', seconds: 30, work: true },
    ],
    once: true,
  },
};

const warmUp: CheckItem = { id: 'warm-up', name: 'Warm up', detail: '5 min', boxes: 1, timer: minutes('Warm up', 5) };

const finisher: CheckGroup = {
  title: 'Finisher',
  note: FINISHER_NOTE,
  items: [
    {
      id: 'finisher',
      name: 'Rounds',
      detail: '5 rounds',
      boxes: 5,
      timer: {
        box: [
          { label: 'Mountain climbers', seconds: 30, work: true },
          { label: 'Bodyweight squats', seconds: 30, work: true },
          { label: 'Jumping jacks', seconds: 30, work: true },
        ],
        gap: { label: 'Rest', seconds: 30 },
      },
    },
  ],
};

export function sessionLabel(day: DayPlan): string {
  if (day.skipFinisher && (day.session === 'A' || day.session === 'B' || day.session === 'C')) {
    return `Workout ${day.session}, no finisher`;
  }
  return SESSION_NAMES[day.session];
}

export function buildChecklist(day: DayPlan): Checklist {
  switch (day.session) {
    case 'A':
    case 'B':
    case 'C': {
      const main: CheckGroup = {
        title: `Workout ${day.session}`,
        note: STRENGTH_NOTE,
        items: [
          warmUp,
          ...WORKOUTS[day.session].map((e) => ({
            id: e.id,
            name: e.name,
            detail: `${e.sets} × ${e.reps}`,
            boxes: e.sets,
            easier: e.easier,
            rest: true,
            timer: SET_TIMERS[e.id],
          })),
        ],
      };
      return {
        groups: day.skipFinisher ? [main] : [main, finisher],
        finisherSkipped: day.skipFinisher,
        footnote: PROGRESSION_NOTE,
      };
    }
    case 'B-light':
      return {
        groups: [
          {
            title: 'Workout B, reduced',
            note: `2 sets per exercise, no burpees, no finisher. ${STRENGTH_NOTE}`,
            items: [
              warmUp,
              ...WORKOUTS.B.filter((e) => e.id !== 'burpees').map((e) => ({
                id: e.id,
                name: e.name,
                detail: `2 × ${e.reps}`,
                boxes: 2,
                rest: true,
              })),
            ],
          },
        ],
        finisherSkipped: false,
      };
    case 'intervals':
      return {
        groups: [
          {
            title: 'Intervals',
            note: INTERVALS_NOTE,
            items: [
              warmUp,
              {
                id: 'rounds',
                name: 'Rounds',
                detail: '10 rounds',
                boxes: 10,
                timer: {
                  box: [
                    { label: 'Hard', seconds: 30, work: true },
                    { label: 'Easy', seconds: 90 },
                  ],
                },
              },
              { id: 'cool-down', name: 'Cool down', detail: '5 min', boxes: 1, timer: minutes('Cool down', 5) },
            ],
          },
        ],
        finisherSkipped: false,
      };
    case 'cardio':
      return {
        groups: [
          {
            title: 'Easy cardio',
            note: 'The walk counts towards steps.',
            items: [
              { id: 'walk', name: 'Brisk walk', detail: '40 min', boxes: 1, timer: minutes('Brisk walk', 40) },
              { id: 'stretch', name: 'Stretching', detail: '10 min', boxes: 1, timer: minutes('Stretching', 10) },
            ],
          },
        ],
        finisherSkipped: false,
      };
    case 'rest':
      return { groups: [], message: 'Full rest today. No workout.', finisherSkipped: false };
    case 'steps':
      return { groups: [], message: 'No workout today. Just the steps.', finisherSkipped: false };
    case 'weigh-in':
      return { groups: [], message: 'Weigh in first, then eat before any training.', finisherSkipped: false };
  }
}

export const checkKeys = (list: Checklist) =>
  list.groups.flatMap((g) => g.items.flatMap((i) => Array.from({ length: i.boxes }, (_, n) => `${i.id}:${n}`)));

export function hasOpenRestBoxes(list: Checklist, checks: Record<string, boolean>) {
  return list.groups.some((g) =>
    g.items.some((i) => i.rest && Array.from({ length: i.boxes }).some((_, n) => !checks[`${i.id}:${n}`])),
  );
}

export const openBoxes = (item: CheckItem, checks: Record<string, boolean>) =>
  Array.from({ length: item.boxes }, (_, n) => n).filter((n) => !checks[`${item.id}:${n}`]);

export const GET_READY: Phase = { label: 'Get ready', seconds: 5 };

// The phases one press of Start runs: the boxes still open, each ending in a tick.
export function timerRun(item: CheckItem, checks: Record<string, boolean>): Phase[] {
  const spec = item.timer;
  if (!spec) return [];
  const open = openBoxes(item, checks);
  const count = spec.once ? Math.min(1, open.length) : open.length;
  if (count === 0) return [];
  const phases: Phase[] = [GET_READY];
  for (let i = 0; i < count; i++) {
    const round = item.boxes > 1 ? `${open[i] + 1} of ${item.boxes}` : undefined;
    spec.box.forEach((p, j) => phases.push({ ...p, round, box: j === spec.box.length - 1 ? open[i] : undefined }));
    if (spec.gap && i < count - 1) phases.push({ ...spec.gap, round: `${open[i + 1] + 1} of ${item.boxes} next` });
  }
  return phases;
}
