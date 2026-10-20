import 'react-native-url-polyfill/auto';
import './src/i18n';
// background notification task must be defined before the app starts
import './src/lib/notifRuntime';

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
