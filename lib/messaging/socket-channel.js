'use babel';

import {Emitter} from 'atom';
import net       from 'net';

//Class for TCP SocketChannel.
export default class SocketChannel {

/*Functions called from outside class*/

  //Create new SocketChannel.
  constructor(host, port, dispatcher) {
    this.host = host;
    this.port = port;
    this.dispatcher = dispatcher;
    this.emitter = new Emitter();
    this.available = false;
    this.socket = new net.Socket();
  }

  //Destroys the socket channel.
  destroy() {
    this.disconnect();
    this.server.close();
    this.emitter.dispose();
  }

  //Establishes a server for the socket channel.
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

  //Closes the server.
  disconnect() {
    if (this.server) {
      this.socket.destroy();
      this.server.close();
    }
  }

  //Sends a message to the socket registered with the server.
  sendMessage(msg) {
    if (this.available) {
      this.socket.write(msg);
    }
  }

/*Functions only called from within class*/

  //Handles a close event for the server.
  handleClose() {
    this.socket = null;
    this.server = null;
    this.available = false;
  }

  //Sends data from the socket to the dispatcher.
  handleData(buffer) {
    this.dispatcher.dispatch(`${buffer}`);
  }

  //Handles an error for the socket.
  handleError() {
    this.emitError();
  }

  //Handles a timeout event for the socket.
  handleTimeout() {
    this.disconnect();
  }

/*EventEmission*/

  emitError() {
    this.emitter.emit('error');
  }

/*EventSubscription*/

  onError(callback) {
    return this.emitter.on('error', callback);
  }
}
