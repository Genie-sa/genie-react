import { Freeze } from 'react-freeze'
import { registerReactFreeze } from './collectors/react/freeze-identity'

registerReactFreeze(Freeze)

export { registerReactFreeze }
