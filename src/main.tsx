import { render } from 'preact';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { App } from './App';
import { getStore } from './store';
import { applyTheme } from './theme';

registerSW({ immediate: true });

// Asks iOS not to clear this app's data when the device is low on storage.
void navigator.storage?.persist?.();

applyTheme(getStore().settings.theme);

render(<App />, document.getElementById('app')!);
