import { useEffect, useRef, useState } from 'preact/hooks';
import { didSaveFail, updateSettings, useStore } from './store';
import { daysBetween, localToday } from './dates';
import { CUT_DAYS, PLAN_START, WEIGH_IN } from './plan';
import { RestTimer, unlockSound } from './RestTimer';
import { ExerciseTimer, type ExerciseRun } from './ExerciseTimer';
import { findItem, setCheck } from './checks';
import { timerRun } from './workout';
import { restartForUpdate, useUpdateReady } from './update';
import { isStandalone } from './components';
import { applyTheme, effectiveTheme } from './theme';
import { TodayView } from './views/TodayView';
import { LogView } from './views/LogView';
import { WorkoutView } from './views/WorkoutView';
import { WeightView } from './views/WeightView';
import { SettingsView } from './views/SettingsView';

const TABS = [
  {
    id: 'today',
    label: 'Today',
    icon: <path d="M4 6h16v15H4zM4 10.5h16M8.5 3v4M15.5 3v4" />,
  },
  {
    id: 'log',
    label: 'Log',
    icon: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  },
  {
    id: 'workout',
    label: 'Workout',
    icon: <path d="M6.5 6v12M3 9v6M17.5 6v12M21 9v6M6.5 12h11" />,
  },
  {
    id: 'weight',
    label: 'Weight',
    icon: <path d="M3 3v18h18M7 9l4 3.5 3-2 6 5.5" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <>
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
  },
] as const;

type TabId = (typeof TABS)[number]['id'];

const SUN = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
  </svg>
);
const MOON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

const currentTab = (): TabId => {
  const hash = location.hash.slice(1);
  return TABS.find((t) => t.id === hash)?.id ?? 'today';
};

const clampedToday = () => {
  const today = localToday();
  return today < PLAN_START ? PLAN_START : today;
};

const dayPill = (today: string) =>
  today <= WEIGH_IN ? `Day ${daysBetween(PLAN_START, today) + 1}/${CUT_DAYS}` : 'After cut';

export function App() {
  const store = useStore();
  const updateReady = useUpdateReady();
  const [tab, setTab] = useState<TabId>(currentTab);
  const [today, setToday] = useState(clampedToday);
  const [date, setDate] = useState(today);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [run, setRun] = useState<ExerciseRun | null>(null);
  const [, redraw] = useState(0);
  const followToday = useRef(true);
  followToday.current = date === today;

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // A Home Screen app can stay open overnight, so check the date on every return.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const fresh = clampedToday();
      setToday(fresh);
      if (followToday.current) setDate(fresh);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Keeps the sun or moon icon right when the phone switches theme by itself.
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => redraw((n) => n + 1);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const startRest = (seconds = store.settings.restSeconds) => {
    unlockSound();
    setRestEnd(Date.now() + seconds * 1000);
  };

  const startExercise = (itemId: string) => {
    const item = findItem(date, itemId);
    if (!item) return;
    const phases = timerRun(item, store.days[date]?.checks ?? {});
    if (phases.length === 0) return;
    unlockSound();
    setRestEnd(null);
    const start = Date.now();
    setRun({ id: start, date, itemId, phases, start, pausedAt: null });
  };

  const boxFromTimer = (n: number) => {
    if (!run) return;
    const item = findItem(run.date, run.itemId);
    if (!item) return;
    const result = setCheck(run.date, item, n, true);
    if (result === 'rest' && item.timer?.once) {
      setRun(null);
      startRest();
    }
  };

  const shown = effectiveTheme(store.settings.theme);
  const switchTheme = () => {
    const theme = shown === 'dark' ? 'light' : 'dark';
    updateSettings({ theme });
    applyTheme(theme);
  };

  const nav = { date, today, setDate };

  return (
    <div class="app">
      <header class="top">
        <div class="brand">Cut Tracker</div>
        <div class="top-right">
          <button type="button" class="themebtn" aria-label="Switch light or dark" onClick={switchTheme}>
            {shown === 'dark' ? SUN : MOON}
          </button>
          <span class="role">{dayPill(today)}</span>
        </div>
      </header>
      <div class="checker" aria-hidden="true" />
      {!isStandalone() && matchMedia('(pointer: coarse)').matches && (
        <div class="sample">
          <b>Add to Home Screen first.</b> Tap Share, then Add to Home Screen. Logs made in Safari stay in Safari, and iOS
          can clear them after 7 days without use.
        </div>
      )}
      {updateReady && run === null && (
        <button type="button" class="sample update" onClick={restartForUpdate}>
          <b>Update ready.</b> Tap to restart the app. Your logs stay.
        </button>
      )}
      {didSaveFail() && (
        <div class="sample">
          <b>This phone refused to save your last change.</b> Export a backup from Settings.
        </div>
      )}
      <main key={tab}>
        <div class="wrap enter">
          {tab === 'today' && <TodayView store={store} {...nav} />}
          {tab === 'log' && <LogView store={store} {...nav} />}
          {tab === 'workout' && (
            <WorkoutView
              store={store}
              {...nav}
              running={run?.date === date ? run.itemId : null}
              onSetDone={() => startRest()}
              onSessionOver={() => setRestEnd(null)}
              onStartTimer={startExercise}
            />
          )}
          {tab === 'weight' && <WeightView store={store} />}
          {tab === 'settings' && <SettingsView store={store} />}
        </div>
      </main>
      {run !== null && (
        <ExerciseTimer
          key={run.id}
          run={run}
          onBox={boxFromTimer}
          onPause={() => setRun((r) => r && { ...r, pausedAt: Date.now() })}
          onResume={() => setRun((r) => r && r.pausedAt !== null ? { ...r, start: r.start + Date.now() - r.pausedAt, pausedAt: null } : r)}
          onStop={() => setRun(null)}
          onFinish={() => setRun(null)}
        />
      )}
      {run === null && restEnd !== null && (
        <RestTimer
          key={restEnd}
          end={restEnd}
          seconds={store.settings.restSeconds}
          onRestart={startRest}
          onClose={() => setRestEnd(null)}
        />
      )}
      <nav class="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} class={t.id === tab ? 'tab is-on' : 'tab'} aria-current={t.id === tab ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
