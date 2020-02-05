import SwController from 'sw-controller'
import createSwStream from 'sw-stream' 
import SwGlobalListener from 'sw-stream/lib/sw-global-listener' 
import EventEmitter from 'safe-event-emitter'
import { getEnvironmentType } from '../lib/util'
import { ENVIRONMENT_TYPE_FULLSCREEN, ENVIRONMENT_TYPE_BACKGROUND } from '../lib/enums'

class Events extends EventEmitter {
  constructor(eventName) {
    super()

    this.eventName = eventName
    this.on(eventName, this.onEvent.bind(this))
  }

  addListener(cb) {
    this.cb = cb
  }

  onEvent(...args) {
    this.cb && this.cb(...args)
  }
}

class RemotePort {
  constructor(event) {
    this.name = event.data.context.name
    this.client = event.source
    this.port = event.ports[0]
    this.sender = {
      id: this.client.id,
      tab: {
        id: this.client.id,
      },
      url: this.client.url,
      origin: event.origin,
    }

    // original onmessage
    this._onmessage = this.port.onmessage
    this.onMessage = new Events('Message-'+this.client.id)
    this.port.onmessage = this.onmessage.bind(this)
  } 

  onmessage(event) {
    this.onMessage.emit('Message-'+this.client.id, event.data)

    // restore original onmessage
    this._onmessage(event)
  }
}

class SwPlatform {
  constructor() {
    this.init()
  }

  init() {
    this.swController = new SwController({
      fileName: '/background.js',
      // optional, scope used when registering service worker
      scope: '/',
      // default: true, pings the service worker to keep it alive
      keepAlive: true,
    })

    // only work in background.js serviceWorker 
    if (self.clients && location.href.indexOf('background.js') !== -1) {
      self.addEventListener('install', event => {
        console.log('install')
        self.skipWaiting()
      })

      self.addEventListener('activate', event => {
        console.log('activate')
        event.waitUntil(clients.claim())
      })

      this.onConnect = new Events('Connect')
      this.onConnectExternal = new Events('ConnectExternal')

      const connectionListener = new SwGlobalListener(self)
      connectionListener.on('remote', (portStream, messageEvent) => {
        const remotePort = new RemotePort(messageEvent)
        this.onConnect.emit('Connect', portStream, remotePort)
      })
    }
  }

  /**
   * Reloads the platform
   */
  reload () {
    // TODO: you can't actually do this
    /** @type {any} */ (global).location.reload()
  }

  async findFirstWindow(envType) {
    const clients = await self.clients.matchAll()
    for (const client of clients) {
      if (client.type === 'window' && getEnvironmentType(client.url) === envType) {
        return client
      }
    }

    return null
  }

  /**
   * Opens a window
   * @param {{url: string}} opts - The window options
   */
  async openWindow (opts) {
    // close all window if exists
    self.clients.matchAll().then((clientList) => {
      for (const client of clientList) {
        if (client.type === 'window' && getEnvironmentType(client.url) !== ENVIRONMENT_TYPE_BACKGROUND) {
          client.postMessage({ 'method': 'closeWindow' })
        }
      }   
    })

    const client = await this.findFirstWindow(ENVIRONMENT_TYPE_BACKGROUND)
    client.postMessage({ 'method': 'openWindow', opts })
  }

  closeCurrentWindow () {
    window.close()
  }

  /**
   * Returns the platform version
   * @returns {string}
   */
  getVersion () {
    return '7.7.0'
  }

  async showPopup () {
    this.openWindow({url: 'notification.html'})
  }

  openExtensionInBrowser (route = null, queryString = null) {
    console.log('openExtensionInBrowser', route, queryString)
    let platformURL = 'home.html'

    if (queryString) {
      platformURL += `?${queryString}`
    }

    if (route) {
      platformURL += `#${route}`
    }
    
    this.openWindow({ url: platformURL })
  }

  currentTab () {
    return {
      active: false,
      id: 0,
    }
  }

  closeTab (tabId) {
    console.log('sw closeTab!!!!', tabId)
    this._reload()
  }

  connect (opts) {
    return new Promise((resolve, reject) => {
      this.swController.once('ready', (activeServiceWorker) => {
        (new Promise((resolve, reject) => {
          console.log(activeServiceWorker)
          if (activeServiceWorker.state === 'activated') {
            resolve()
          } else {
            // trigger when install service worker, and it's claims
            navigator.serviceWorker.addEventListener('controllerchange', (event) => {
              resolve()
            })
          }
        })).then(() => {
          console.log('done')
          const swStream = createSwStream({
            serviceWorker: this.swController.getWorker(),
            context: {
              name: opts.name,
            },
          })
          
          this.swController.serviceWorkerApi.addEventListener('message', event => {
            if (event.data.method === 'openWindow') {
              this._openWindow(event.data.opts)
            }
            else if (event.data.method === 'closeWindow') {
              this._closeWindow()
            }
          })

          resolve(swStream)
        })
      })
      this.swController.startWorker()
    })
  }

  _reload() {
    location.reload()
  }

  _closeWindow() {
    window.close()
  }

  _openWindow(opts) {
    if (window.top == window.self) {
      window.open(opts.url)
    } 
    else {
      // when it's in iframe
      window.postMessage({ 'method': 'openWindow', opts })
    }
  }

}

export default SwPlatform
