import { useRef, useState } from 'preact/hooks';
import { NumberField, isStandalone } from '../components';
import { WEEKDAY_NAMES, localToday, shortDate } from '../dates';
import { PHASES, type Macros, type PhaseId } from '../plan';
import { parseStore, replaceStore, updateSettings, type Store } from '../store';

const FIELDS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
];

async function shareBackup(store: Store) {
  const today = localToday();
  const body = JSON.stringify({ ...store, settings: { ...store.settings, lastBackup: today } }, null, 2);
  const file = new File([body], `cut-tracker-${today}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
  } else {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  updateSettings({ lastBackup: today });
}

export function SettingsView({ store }: { store: Store }) {
  const { settings } = store;
  const picker = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const setTarget = (id: PhaseId, key: keyof Macros, value: number | undefined) => {
    if (value === undefined) return;
    const base = settings.targets[id] ?? PHASES[id].targets;
    updateSettings({ targets: { ...settings.targets, [id]: { ...base, [key]: value } } });
  };

  const exportBackup = async () => {
    try {
      await shareBackup(store);
      setMessage('Backup created. Save it to Files or iCloud Drive.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessage('The backup could not be created.');
    }
  };

  const importBackup = async (file: File) => {
    const parsed = parseStore(await file.text());
    if (!parsed) return setMessage('That file is not a Cut Tracker backup. Nothing was changed.');
    const days = Object.keys(parsed.days).length;
    if (confirm(`Replace everything on this phone with this backup (${days} days)?`)) {
      replaceStore(parsed);
      setMessage(`Restored ${days} days.`);
    }
  };

  return (
    <>
      <header class="datebar">
        <div>
          <h1>Settings</h1>
        </div>
      </header>

      <section class="block">
        <h2>Your data</h2>
        <p>Logs are saved only on this phone. Nothing is uploaded, so a lost phone means lost logs unless you keep a backup.</p>
        {!isStandalone() && (
          <p class="muted-text">Add this to your Home Screen so iOS keeps your data: Share, then Add to Home Screen.</p>
        )}
        <p class="num meta">Last backup: {settings.lastBackup ? shortDate(settings.lastBackup) : 'never'}</p>
        <div class="button-row">
          <button class="button" type="button" onClick={exportBackup}>Export backup</button>
          <button class="button button-quiet" type="button" onClick={() => picker.current?.click()}>Restore</button>
        </div>
        <input
          ref={picker}
          class="hidden"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void importBackup(file);
          }}
        />
        {message && <p class="muted-text" role="status">{message}</p>}
      </section>

      <section class="block">
        <h2>Rest day after the cut</h2>
        <label class="field">
          <span class="field-label">From 14 Nov the sessions repeat, with this day off.</span>
          <span class="field-entry">
            <select
              value={settings.restDay}
              onChange={(e) => updateSettings({ restDay: Number(e.currentTarget.value) })}
            >
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={name} value={i}>{name}</option>
              ))}
            </select>
          </span>
        </label>
      </section>

      <section class="block">
        <h2>Nutrition targets</h2>
        <p class="muted-text">
          Use these to correct the numbers for you, not to cut harder. Going over a target never creates a deficit to make up.
        </p>
        {(Object.keys(PHASES) as PhaseId[]).map((id) => {
          const phase = PHASES[id];
          const current = settings.targets[id] ?? phase.targets;
          return (
            <div class="target-group" key={id}>
              <h3>
                {phase.label} <span class="num meta">{phase.dates}</span>
              </h3>
              <div class="grid-2">
                {FIELDS.map((f) => (
                  <NumberField
                    key={`${f.key}-${settings.targets[id] ? 'edited' : 'plan'}`}
                    label={f.label}
                    unit={f.unit}
                    min={1}
                    max={10000}
                    value={current[f.key]}
                    onCommit={(v) => setTarget(id, f.key, v)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <button class="button button-quiet" type="button" onClick={() => updateSettings({ targets: {} })}>
          Reset to the plan's numbers
        </button>
      </section>
    </>
  );
}
