// The plan, as data. These numbers are the app's source of truth.

export const PLAN_START = '2026-11-03';
export const WEIGH_IN = '2026-11-13';
export const CUT_DAYS = 11;

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type PhaseId = 'base' | 'lowCarb' | 'lowFibre' | 'after';

export interface Phase {
  id: PhaseId;
  label: string;
  dates: string;
  targets: Macros;
  focus: string;
}

export const PHASES: Record<PhaseId, Phase> = {
  base: {
    id: 'base',
    label: 'Base',
    dates: '3–8 Nov',
    targets: { kcal: 1700, protein: 170, carbs: 140, fat: 50 },
    focus: 'Lean meat, fish, vegetables, rice or potato.',
  },
  lowCarb: {
    id: 'lowCarb',
    label: 'Lower starch',
    dates: '9–10 Nov',
    targets: { kcal: 1500, protein: 170, carbs: 75, fat: 55 },
    focus: 'Mostly protein and vegetables, little starch, no salty processed food.',
  },
  lowFibre: {
    id: 'lowFibre',
    label: 'Low fibre',
    dates: '11–12 Nov',
    targets: { kcal: 1400, protein: 160, carbs: 80, fat: 50 },
    focus: 'Low fibre and low salt: eggs, chicken, fish, small portions of white rice. No vegetables, beans or whole grains.',
  },
  after: {
    id: 'after',
    label: 'After the cut',
    dates: 'From 14 Nov',
    targets: { kcal: 1700, protein: 170, carbs: 140, fat: 50 },
    focus: 'Normal fibre and salt.',
  },
};

export const WEIGH_IN_FOCUS = 'Weigh in first, then eat before any training.';

export type SessionId = 'A' | 'B' | 'C' | 'B-light' | 'intervals' | 'cardio' | 'rest' | 'steps' | 'weigh-in';

export const SESSION_NAMES: Record<SessionId, string> = {
  A: 'Workout A + finisher',
  B: 'Workout B + finisher',
  C: 'Workout C + finisher',
  'B-light': 'Workout B, reduced',
  intervals: 'Intervals, 10 rounds',
  cardio: 'Easy cardio',
  rest: 'Full rest',
  steps: 'Steps only',
  'weigh-in': 'Morning weigh-in',
};

export const CUT_SCHEDULE: Record<string, { session: SessionId; steps: number | null }> = {
  '2026-11-03': { session: 'A', steps: 15000 },
  '2026-11-04': { session: 'intervals', steps: 15000 },
  '2026-11-05': { session: 'B', steps: 18000 },
  '2026-11-06': { session: 'cardio', steps: 18000 },
  '2026-11-07': { session: 'C', steps: 18000 },
  '2026-11-08': { session: 'rest', steps: null },
  '2026-11-09': { session: 'A', steps: 18000 },
  '2026-11-10': { session: 'intervals', steps: 18000 },
  '2026-11-11': { session: 'B-light', steps: 15000 },
  '2026-11-12': { session: 'steps', steps: 15000 },
  '2026-11-13': { session: 'weigh-in', steps: null },
};

export const ROTATION: SessionId[] = ['A', 'intervals', 'B', 'cardio', 'C'];

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  easier?: string;
}

const EASIER_PUSH_UP = 'Easier: hands on a sturdy table or sofa.';
const EASIER_JUMP = 'Easier: regular squats instead of jumps.';

export const WORKOUTS: Record<'A' | 'B' | 'C', Exercise[]> = {
  A: [
    { id: 'squat-jumps', name: 'Squat jumps', sets: 3, reps: '8', easier: EASIER_JUMP },
    { id: 'split-squats', name: 'Bulgarian split squats', sets: 3, reps: '10 per leg' },
    { id: 'push-ups', name: 'Push-ups', sets: 4, reps: '1–2 short of failure', easier: EASIER_PUSH_UP },
    { id: 'superman-pulls', name: 'Superman pulls', sets: 3, reps: '12' },
    { id: 'plank', name: 'Plank', sets: 3, reps: '40 sec' },
  ],
  B: [
    { id: 'burpees', name: 'Burpees', sets: 3, reps: '8' },
    { id: 'reverse-lunges', name: 'Reverse lunges', sets: 3, reps: '12 per leg' },
    { id: 'pike-push-ups', name: 'Pike push-ups', sets: 3, reps: '8' },
    { id: 'snow-angels', name: 'Reverse snow angels', sets: 3, reps: '12' },
    { id: 'hip-thrusts', name: 'Single-leg hip thrusts', sets: 3, reps: '12 per leg' },
  ],
  C: [
    { id: 'broad-jumps', name: 'Broad jumps', sets: 3, reps: '5', easier: EASIER_JUMP },
    { id: 'slow-squats', name: 'Slow squats (3 sec down)', sets: 3, reps: '15' },
    { id: 'elevated-push-ups', name: 'Feet-elevated push-ups', sets: 3, reps: '8–12' },
    { id: 'y-raises', name: 'Prone Y-raises', sets: 3, reps: '12' },
    { id: 'side-plank', name: 'Side plank', sets: 3, reps: '30 sec per side' },
  ],
};

export const STRENGTH_NOTE = 'Rest 60–90 seconds between sets. Stop each set with 1–2 good reps left.';
export const FINISHER_NOTE = 'Mountain climbers, bodyweight squats and jumping jacks, 30 seconds each, then 30 seconds of rest.';
export const INTERVALS_NOTE = '30 seconds hard, 90 seconds easy. High knees, jumping jacks, mountain climbers or outdoor sprints.';
export const PROGRESSION_NOTE = 'Each week, add 1–2 reps per set or lower more slowly.';
export const JOG_NOTE =
  'Replace one walk with a 20–30 minute jog at 7:00–8:30 min/km, slow enough to speak in full sentences. Jogging steps count. New to jogging? Alternate 2 minutes jogging and 2 minutes walking.';
export const JOG_DAYS = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09', '2026-11-10'];

export const CHECKPOINTS = [
  { date: '2026-11-07', target: 80.5 },
  { date: '2026-11-10', target: 79.8 },
  { date: '2026-11-12', target: 78.8 },
  { date: '2026-11-13', target: 78.0 },
];

export const DECISION_DATE = '2026-11-10';
export const DECISION_LIMIT = 80.5;

export const WEIGH_NOTE = 'Weigh each morning after using the toilet.';
export const SWING_NOTE = 'Daily weight can swing by about 1 kg, so read the trend as well as the latest value.';
export const DECISION_NOTE =
  "Above 80.5 kg on 10 Nov means 78 kg by 13 Nov probably won't happen safely. Keep following the plan and accept the result, likely around 79 kg.";
export const REBOUND_NOTE =
  'Expect a 1–2 kg rebound in the first few days, mostly water and food. This is normal and not a setback.';
export const OVER_TARGET_NOTE = 'Over target today. Tomorrow is the normal target, with nothing to make up.';
export const ABOVE_CHECKPOINT_NOTE = 'Above this checkpoint. Keep following the plan as written.';

export const ABOVE_ANY_CHECKPOINT_NOTE = 'Being above a checkpoint changes nothing. Keep following the plan as written.';

export const WATER_TARGET_NOTE = '3–4 L today.';
export const WATER_THIRST_NOTE = '3–4 L today. After dinner, drink to thirst until the weigh-in.';
export const WATER_WEIGH_IN_NOTE = 'Drink to thirst until the weigh-in.';

export type FlagId = 'pain' | 'fatigue' | 'dizzy' | 'emergency';

export const FLAGS: { id: FlagId; label: string; advice: string }[] = [
  {
    id: 'pain',
    label: 'Shin, foot or knee pain',
    advice: 'Drop to 12,000 steps and skip the finisher. Get persistent pain checked.',
  },
  {
    id: 'fatigue',
    label: 'Poor sleep, drained, or noticeably worse workouts',
    advice: 'Two days of this in a row means 15,000 steps and no finisher.',
  },
  { id: 'dizzy', label: 'Dizzy or shaky', advice: 'Eat something and rest.' },
  { id: 'emergency', label: 'Fainting, confusion or a racing heart', advice: 'Stop and get medical help.' },
];
