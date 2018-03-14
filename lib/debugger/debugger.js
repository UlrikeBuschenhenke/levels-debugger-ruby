'use babel';

import {Emitter}         from 'atom';
import DebuggerState     from './debugger-state';

export default class Debugger {
  constructor() {
    this.emitter = new Emitter();
    this.state = new DebuggerState();
  }

  start() {
    this.emitReady();
  }

  stop() {
    this.emitStop();
    this.destroy();
  }

  destroy() {
    this.emitter.dispose();
  }

  updatePosition(message) {
    this.state.setPosition(message.getPosition());
    //TODO: handleAutoStepping realisieren.
  }

  emitReady() {
    this.emitter.emit('debugger-ready');
  }

  emitStop() {
    this.emitter.emit('debugger-stop');
  }

  onReady(callback) {
    return this.emitter.on('debugger-ready', callback);
  }

  onStop(callback) {
    return this.emitter.on('debugger-stop', callback);
  }
}
