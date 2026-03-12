/**
  * The entry point.
  *
  * @module tspace-spear
  */
export * from './core/decorators'
export * from './core/server/router'
export * from './core/server'
export { T } from './core/types'

import Spear from './core/server';

export default Spear