import serialize from 'serialize-javascript'
import log from 'loglevel'
import { openDB, deleteDB, wrap, unwrap } from 'idb'

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
    this.isSupported = !!(window.indexedDB)
    if (!this.isSupported) {
      log.error('Storage local API not available.')
    }
  }

  async init() {
    this.db = await openDB('metamask', 1, {
      async upgrade(db, oldVersion) {
        db.createObjectStore('background')
      },
    })
  }

  /**
   * Returns all of the keys currently saved
   * @returns {Promise<*>}
   */
  async get () {
    if (!this.isSupported) {
      return undefined
    }

    if (!this.db) {
      await this.init()
    }

    const result = await this.db.get('background', 'state') 
    return deserialize(result)
  }

  /**
   * Sets the key in local state
   * @param {object} state - The state to set
   */
  async set (state) {
    if (!this.db) {
      await this.init()
    }

    const result = await this.db.put('background', serialize(state), 'state')
  }
}