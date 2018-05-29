'use babel';

import {Emitter} from 'atom';
import net       from 'net';

export default class SocketChannel {
  constructor(host, port, dispatcher) {
    this.host = host;
    this.port = port;
    this.dispatcher = dispatcher;
    this.emitter = new Emitter();
    this.available = false;
    this.socket = new net.Socket();
  }

  destroy() {
    this.disconnect();
    this.server.close();
    this.emitter.dispose();
  }

  connect() {
    if (!this.server) {
      this.server = net.createServer();
      this.server.listen(this.port, this.host);
      const connectionListener = socket => {
        this.socket = socket;
        socket.setNoDelay(true);
        this.available = true;
        socket.on('data', data => this.handleData(data));
        socket.on('error', () => this.handleError());
        socket.on('timeout', () => this.handleTimeout());
      };
      this.server.on('connection', connectionListener);
      this.server.on('close', () => this.handleClose());
    }
  }

  disconnect() {
    if (this.server) {
      this.socket.destroy();
    }
  }

  handleClose() {
    this.socket = null;
    this.server = null;
    this.available = false;
  }

  handleData(buffer) {
    this.dispatcher.dispatch(`${buffer}`);
  }

  handleError() {
    this.emitError();
  }

  handleTimeout() {
    this.disconnect();
  }

  sendMessage(msg) {
    if (this.available) {
      this.socket.write(msg);
    }
  }

  emitError() {
    this.emitter.emit('error');
  }

  onError(callback) {
    return this.emitter.on('error', callback);
  }
}
