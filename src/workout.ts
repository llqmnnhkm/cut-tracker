// Builds the checklist for a day's session, including the modified versions.

import { FINISHER_NOTE, INTERVALS_NOTE, PROGRESSION_NOTE, SESSION_NAMES, STRENGTH_NOTE, WORKOUTS } from './plan';
import type { DayPlan } from './rules';

export interface CheckItem {
  id: string;
  name: string;
  detail: string;
  boxes: number;
  easier?: string;
  rest?: boolean; // ticking a box starts the rest timer
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

const warmUp: CheckItem = { id: 'warm-up', name: 'Warm up', detail: '5 min', boxes: 1 };

const finisher: CheckGroup = {
  title: 'Finisher',
  note: FINISHER_NOTE,
  items: [{ id: 'finisher', name: 'Rounds', detail: '5 rounds', boxes: 5 }],
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
              { id: 'rounds', name: 'Rounds', detail: '10 rounds', boxes: 10 },
              { id: 'cool-down', name: 'Cool down', detail: '5 min', boxes: 1 },
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
              { id: 'walk', name: 'Brisk walk', detail: '40 min', boxes: 1 },
              { id: 'stretch', name: 'Stretching', detail: '10 min', boxes: 1 },
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
