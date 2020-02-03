import EventEmitter from 'safe-event-emitter'
 
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

class Port {
  constructor(name) {
    this.name = name
    this.messageChannel = new MessageChannel()
  } 

  connect() {
    navigator.serviceWorker.controller.postMessage({ method: 'connect', name: this.name }, [this.messageChannel.port2])
  }
}

class RemotePort {
  constructor(event) {
    this.name = event.data.name
    this.client = event.source
    this.port = event.ports[0]
    this.sender = {
      id: this.client.id,
      tab: {
        id: this.client.id,
      },
      url: this.client.url,
    }
    this.onMessage = new Events('Message-'+this.name)
    this.port.onmessage = this.onmessage.bind(this)
  } 

  onmessage(event) {
    this.onMessage.emit('Message-'+this.name, event.data) 
  }
}

export default class ServiceWorker {
  constructor() {
  }

  // for client
  connect(name) {
    const port = new Port(name)
    port.connect()
    return port
  }

  // for service worker
  onConnect(serviceWorker, cb) {
    serviceWorker.addEventListener('message', function(event) {
      if (event.data.method === 'connect') {
        const port = new RemotePort(event)
        cb(null, port)
      }
    })
  }
}
