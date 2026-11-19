import { useEffect, useState } from 'preact/hooks';
import { ACTIVITY_NAMES, clock, km, pace, type ActivityType } from '../activity';
import { ACTIVITY_ICONS, ActivityCard, Route, StatRow } from '../ActivityCard';
import { addDays, localToday } from '../dates';
import { holdScreen } from '../sound';
import { addActivity, allActivities, removeActivity, type Store } from '../store';
import {
  currentPace,
  discardRecording,
  finishRecording,
  movingSeconds,
  pauseRecording,
  resumeRecording,
  setRecordingType,
  startRecording,
  type Recording,
} from '../recorder';
import { parseAmount } from '../rules';

const TYPES: ActivityType[] = ['walk', 'run'];

function TypePicker({ value, onChange }: { value: ActivityType; onChange: (t: ActivityType) => void }) {
  return (
    <div class="segmented" role="radiogroup" aria-label="Activity">
      {TYPES.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={t === value} class={t === value ? 'seg is-on' : 'seg'} onClick={() => onChange(t)}>
          {ACTIVITY_ICONS[t]}
          {ACTIVITY_NAMES[t]}
        </button>
      ))}
    </div>
  );
}

function gpsText(r: Recording) {
  if (r.legStart === null) return 'Paused';
  switch (r.gps) {
    case 'waiting':
      return 'Finding GPS…';
    case 'ok':
      return `GPS ready · ±${Math.round(r.accuracy ?? 0)} m`;
    case 'weak':
      return 'Weak GPS. Distance may lag; time keeps counting.';
    case 'denied':
      return 'Location is off for this app. Allow it in iPhone Settings → Privacy → Location Services → Safari Websites.';
    case 'unavailable':
      return 'This phone has no GPS here. Time still counts.';
  }
}

function Recorder({ rec }: { rec: Recording }) {
  const [now, setNow] = useState(Date.now());
  const paused = rec.legStart === null;
  const seconds = movingSeconds(rec, now);
  const live = paused ? null : currentPace(now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  useEffect(holdScreen, []);

  const finish = () => {
    if (finishRecording()) location.hash = '#today';
  };
  const discard = () => {
    if (confirm('Discard this recording? It will not be saved.')) discardRecording();
  };

  return (
    <section class="rec">
      <p class={`gps gps-${paused ? 'paused' : rec.gps}`} role="status">
        <i />
        {gpsText(rec)}
      </p>
      <div class="rec-time">
        <small>Time</small>
        <b class="num">{clock(seconds)}</b>
      </div>
      <StatRow
        items={[
          { label: 'Distance', value: km(rec.track.meters), unit: 'km' },
          { label: 'Avg pace', value: pace(seconds, rec.track.meters), unit: '/km' },
          { label: 'Current', value: live ? clock(live) : '–:––', unit: '/km' },
        ]}
      />
      <div class="rec-map">
        {rec.track.route.length > 1 ? <Route route={rec.track.route} big /> : <p class="rec-map-empty">Your route draws here as you move.</p>}
      </div>
      <div class="segmented segmented-sm">
        {TYPES.map((t) => (
          <button key={t} type="button" class={t === rec.type ? 'seg is-on' : 'seg'} aria-pressed={t === rec.type} onClick={() => setRecordingType(t)}>
            {ACTIVITY_NAMES[t]}
          </button>
        ))}
      </div>
      <div class="rec-actions">
        {paused ? (
          <>
            <button type="button" class="roundbtn roundbtn-go" onClick={resumeRecording}>Resume</button>
            <button type="button" class="roundbtn roundbtn-dark" onClick={finish}>Finish</button>
          </>
        ) : (
          <button type="button" class="roundbtn roundbtn-dark" onClick={pauseRecording} aria-label="Pause">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
          </button>
        )}
      </div>
      {paused && (
        <button type="button" class="textlink textlink-quiet rec-discard" onClick={discard}>
          Discard recording
        </button>
      )}
      <p class="muted-text rec-tip">Keep Cut Tracker open on screen. iPhone stops GPS for web apps when the screen locks or you switch apps.</p>
    </section>
  );
}

function ManualForm({ type }: { type: ActivityType }) {
  const [minutes, setMinutes] = useState('');
  const [dist, setDist] = useState('');
  const [when, setWhen] = useState<'today' | 'yesterday'>('today');
  const [error, setError] = useState('');

  const submit = (e: Event) => {
    e.preventDefault();
    const mins = parseAmount(minutes);
    const kms = parseAmount(dist.replace(',', '.'));
    if (mins === undefined || !Number.isFinite(mins) || mins <= 0 || mins > 1440) return setError('Enter the time in minutes.');
    if (kms === undefined || !Number.isFinite(kms) || kms < 0 || kms > 200) return setError('Enter the distance in km.');
    const date = when === 'today' ? localToday() : addDays(localToday(), -1);
    const [y, m, d] = date.split('-').map(Number);
    const start = when === 'today' ? Date.now() - mins * 60_000 : new Date(y, m - 1, d, 12).getTime();
    addActivity(date, { id: `${start}-m`, type, start, seconds: Math.round(mins * 60), meters: Math.round(kms * 1000), manual: true });
    setMinutes('');
    setDist('');
    setError('');
  };

  return (
    <form class="panel meal-form" onSubmit={submit}>
      <h3>Add without GPS</h3>
      <p class="muted-text">For a treadmill, or a {ACTIVITY_NAMES[type].toLowerCase()} you forgot to record.</p>
      <div class="grid-2">
        <label class="field">
          <span class="field-label">Time</span>
          <span class="inp">
            <input class="num" inputmode="numeric" autocomplete="off" value={minutes} onInput={(e) => setMinutes(e.currentTarget.value)} />
            <span class="field-unit">min</span>
          </span>
        </label>
        <label class="field">
          <span class="field-label">Distance</span>
          <span class="inp">
            <input class="num" inputmode="decimal" autocomplete="off" value={dist} onInput={(e) => setDist(e.currentTarget.value)} />
            <span class="field-unit">km</span>
          </span>
        </label>
      </div>
      <div class="segmented segmented-sm" role="radiogroup" aria-label="Day">
        {(['today', 'yesterday'] as const).map((w) => (
          <button key={w} type="button" role="radio" aria-checked={w === when} class={w === when ? 'seg is-on' : 'seg'} onClick={() => setWhen(w)}>
            {w === 'today' ? 'Today' : 'Yesterday'}
          </button>
        ))}
      </div>
      {error && <p class="field-error">{error}</p>}
      <button class="btn" type="submit">Add {ACTIVITY_NAMES[type].toLowerCase()}</button>
    </form>
  );
}

export function RecordView({ store, rec }: { store: Store; rec: Recording | null }) {
  const [type, setType] = useState<ActivityType>('walk');
  const list = allActivities(store);

  if (rec) return <Recorder rec={rec} />;

  return (
    <>
      <section class="rec rec-idle">
        <TypePicker value={type} onChange={setType} />
        <button type="button" class="startbtn" onClick={() => startRecording(type)}>
          <span>Start</span>
        </button>
        <p class="muted-text rec-tip">Records time, distance, pace and your route with GPS. Keep the app open on screen while you go.</p>
      </section>

      <ManualForm type={type} />

      <h2 class="section-title">Your activities</h2>
      {list.length === 0 ? (
        <p class="note">No walks or runs yet. Tap Start when you head out.</p>
      ) : (
        list.map(({ date, activity }) => (
          <ActivityCard
            key={activity.id}
            date={date}
            activity={activity}
            onRemove={() => confirm('Delete this activity?') && removeActivity(date, activity.id)}
          />
        ))
      )}
    </>
  );
}
