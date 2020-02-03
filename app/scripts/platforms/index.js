import ExtensionPlatform from './extension'
import SwPlatform from './sw'

let platform = null
switch (process.env.PLATFORM) {
  case 'extension':
    platform = new ExtensionPlatform()
  case 'sw':
  default:
    platform = new SwPlatform()
}

export default platform
