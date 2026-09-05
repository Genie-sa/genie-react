// Install the DevTools hook before Expo loads React Native's renderer.
import 'genie-react/hook'
import { registerRootComponent } from 'expo'
import { registerReactFreeze } from 'genie-react/react-freeze'
import { Freeze } from 'react-freeze'

import App from './App'

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerReactFreeze(Freeze)
registerRootComponent(App)
