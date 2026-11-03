import { render } from 'preact';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { App } from './App';

registerSW({ immediate: true });

// Asks iOS not to clear this app's data when the device is low on storage.
void navigator.storage?.persist?.();

render(<App />, document.getElementById('app')!);
