/**
 * Buffer polyfill — must come first.
 * xrpl encode/decode and @ledgerhq/hw-app-xrp both rely on Buffer.
 * Hermes in React Native does not provide it as a global by default.
 */
import {Buffer} from 'buffer';
global.Buffer = global.Buffer || Buffer;

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
