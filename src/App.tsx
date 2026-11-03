import { useEffect, useRef, useState } from 'preact/hooks';
import { didSaveFail, useStore } from './store';
import { localToday } from './dates';
import { PLAN_START } from './plan';
import { RestTimer, unlockSound } from './RestTimer';
import { TodayView } from './views/TodayView';
import { LogView } from './views/LogView';
import { WorkoutView } from './views/WorkoutView';
import { WeightView } from './views/WeightView';
import { SettingsView } from './views/SettingsView';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'log', label: 'Log' },
  { id: 'workout', label: 'Workout' },
  { id: 'weight', label: 'Weight' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const currentTab = (): TabId => {
  const hash = location.hash.slice(1);
  return TABS.find((t) => t.id === hash)?.id ?? 'today';
};

const clampedToday = () => {
  const today = localToday();
  return today < PLAN_START ? PLAN_START : today;
};

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<TabId>(currentTab);
  const [today, setToday] = useState(clampedToday);
  const [date, setDate] = useState(today);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const followToday = useRef(true);
  followToday.current = date === today;

  useEffect(() => {
    const onHash = () => {
      setTab(currentTab());
      window.scrollTo(0, 0);
    };
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

  const startRest = (seconds = store.settings.restSeconds) => {
    unlockSound();
    setRestEnd(Date.now() + seconds * 1000);
  };

  const nav = { date, today, setDate };

  return (
    <div class="shell">
      <main class="page" key={tab}>
        {didSaveFail() && (
          <p class="alert">This phone refused to save your last change. Export a backup from Settings.</p>
        )}
        {tab === 'today' && <TodayView store={store} {...nav} />}
        {tab === 'log' && <LogView store={store} {...nav} />}
        {tab === 'workout' && (
          <WorkoutView store={store} {...nav} onSetDone={() => startRest()} onSessionOver={() => setRestEnd(null)} />
        )}
        {tab === 'weight' && <WeightView store={store} />}
        {tab === 'settings' && <SettingsView store={store} />}
      </main>
      <div class="dock">
        {restEnd !== null && (
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
              {t.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
