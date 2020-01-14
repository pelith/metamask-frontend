import serialize from 'serialize-javascript'
import log from 'loglevel'

function deserialize(serializedJavascript){
  return eval('(' + serializedJavascript + ')');
}

/**
 * A wrapper around the browser's storage local API
 */
export default class BrowserStore {
  /**
   * @constructor
   */
  constructor () {
    this.isSupported = !!(window.localStorage)
    if (!this.isSupported) {
      log.error('Storage local API not available.')
    }
  }

  /**
   * Returns all of the keys currently saved
   * @return {Promise<*>}
   */
  get () {
    if (!this.isSupported) {
      return undefined
    }
    const result = window.localStorage.getItem('state') || {}
    // extension.storage.local always returns an obj
    // if the object is empty, treat it as undefined
    if (isEmpty(result)) {
      return undefined
    } else {
      return deserialize(result)
    }
  }

  /**
   * Sets the key in local state
   * @param {object} state - The state to set
   */
  set (state) {
    window.localStorage.setItem('state', serialize(state))
  }
}

/**
 * Returns whether or not the given object contains no keys
 * @param {object} obj - The object to check
 * @returns {boolean}
 */
function isEmpty (obj) {
  return Object.keys(obj).length === 0
}
