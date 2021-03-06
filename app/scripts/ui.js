
// this must run before anything else
import './lib/freezeGlobals'

// polyfills
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'

import PortStream from 'extension-port-stream'
import { getEnvironmentType } from './lib/util'

import {
  ENVIRONMENT_TYPE_NOTIFICATION,
  ENVIRONMENT_TYPE_FULLSCREEN,
  ENVIRONMENT_TYPE_POPUP,
} from './lib/enums'

import extension from 'extensionizer'
import ExtensionPlatform from './platforms/extension'
import NotificationManager from './lib/notification-manager'

const notificationManager = new NotificationManager()
// import setupSentry from './lib/setupSentry'
import { EventEmitter } from 'events'
import Dnode from 'dnode'
import Eth from 'ethjs'
import EthQuery from 'eth-query'
import urlUtil from 'url'
import launchMetaMaskUi from '../../ui'
import StreamProvider from 'web3-stream-provider'
import { setupMultiplex } from './lib/stream-utils.js'
import log from 'loglevel'
import platform from './platforms'

start().catch(log.error)

async function start () {

  // create platform global
  global.platform = platform

  // setup sentry error reporting
  // const release = global.platform.getVersion()
  // setupSentry({ release, getState })
  // provide app state to append to error logs
  function getState () {
    // get app state
    const state = window.getCleanAppState()
    // remove unnecessary data
    delete state.localeMessages
    delete state.metamask.recentBlocks
    // return state to be added to request
    return state
  }

  // identify window type (popup, notification)
  const windowType = getEnvironmentType()
  global.METAMASK_UI_TYPE = windowType
  closePopupIfOpen(windowType)

  // setup stream to background

  const connectionStream = await platform.connect({ name: windowType })

  const activeTab = await queryCurrentActiveTab(windowType)
  initializeUiWithTab(activeTab)

  function closePopupIfOpen (windowType) {
    if (windowType !== ENVIRONMENT_TYPE_NOTIFICATION) {
      // should close only chrome popup
      notificationManager.closePopup()
    }
  }

  function displayCriticalError (container, err) {
    container.innerHTML = '<div class="critical-error">The MetaMask app failed to load: please open and close MetaMask again to restart.</div>'
    container.style.height = '80px'
    log.error(err.stack)
    throw err
  }

  function initializeUiWithTab (tab) {
    const container = document.getElementById('app-content')
    initializeUi(tab, container, connectionStream, (err, store) => {
      if (err) {
        return displayCriticalError(container, err)
      }

      const state = store.getState()
      const { metamask: { completedOnboarding } = {} } = state

      if (!completedOnboarding && windowType !== ENVIRONMENT_TYPE_FULLSCREEN) {
        global.platform.openExtensionInBrowser()
      }
    })
  }
}

async function queryCurrentActiveTab (windowType) {
  return new Promise((resolve) => {
    // At the time of writing we only have the `activeTab` permission which means
    // that this query will only succeed in the popup context (i.e. after a "browserAction")
    if (windowType !== ENVIRONMENT_TYPE_POPUP) {
      resolve({})
      return
    }

    const title = document.title
    const url = document.URL
    const { hostname: origin, protocol } = url ? urlUtil.parse(url) : {}
    resolve({
      title, origin, protocol, url,
    })
  })
}

function initializeUi (activeTab, container, connectionStream, cb) {
  connectToAccountManager(connectionStream, (err, backgroundConnection) => {
    if (err) {
      return cb(err)
    }

    launchMetaMaskUi({
      activeTab,
      container,
      backgroundConnection,
    }, cb)
  })
}

/**
 * Establishes a connection to the background and a Web3 provider
 *
 * @param {PortDuplexStream} connectionStream - PortStream instance establishing a background connection
 * @param {Function} cb - Called when controller connection is established
 */
function connectToAccountManager (connectionStream, cb) {
  const mx = setupMultiplex(connectionStream)
  setupControllerConnection(mx.createStream('controller'), cb)
  setupWeb3Connection(mx.createStream('url-provider'))
}

/**
 * Establishes a streamed connection to a Web3 provider
 *
 * @param {PortDuplexStream} connectionStream - PortStream instance establishing a background connection
 */
function setupWeb3Connection (connectionStream) {
  const providerStream = new StreamProvider()
  providerStream.pipe(connectionStream).pipe(providerStream)
  connectionStream.on('error', console.error.bind(console))
  providerStream.on('error', console.error.bind(console))
  global.ethereumProvider = providerStream
  global.ethQuery = new EthQuery(providerStream)
  global.eth = new Eth(providerStream)
}

/**
 * Establishes a streamed connection to the background account manager
 *
 * @param {PortDuplexStream} connectionStream - PortStream instance establishing a background connection
 * @param {Function} cb - Called when the remote account manager connection is established
 */
function setupControllerConnection (connectionStream, cb) {
  const eventEmitter = new EventEmitter()
  const backgroundDnode = Dnode({
    sendUpdate: function (state) {
      eventEmitter.emit('update', state)
    },
  })
  connectionStream.pipe(backgroundDnode).pipe(connectionStream)
  backgroundDnode.once('remote', function (backgroundConnection) {
    backgroundConnection.on = eventEmitter.on.bind(eventEmitter)
    cb(null, backgroundConnection)
  })
}
