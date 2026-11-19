import { render } from 'preact';
import './update';
import './styles.css';
import { App } from './App';
import { getStore } from './store';
import { applyTheme } from './theme';

// Asks iOS not to clear this app's data when the device is low on storage.
void navigator.storage?.persist?.();

applyTheme(getStore().settings.theme);

render(<App />, document.getElementById('app')!);
