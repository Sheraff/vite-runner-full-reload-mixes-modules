import './other.js'
import { registry } from './registry.js'
import './slow.js'
import { b } from './b.js'

export const app = { registry, bRegistry: b.registry }
