'use babel';

import {Emitter}                                      from 'atom';
import {DELIMITER, FINAL_SYMBOL, removeNewlineSymbol} from './message-utils';

//Class for message handling.
export default class IncomingMessageDispatcher {

/*Functions called from outside class*/

  //Create new IncomingMessageDispatcher.
  constructor() {
    this.emitter = new Emitter();
  }

  //Destroy IncomingMessageDispatcher.
  destroy() {
    this.emitter.dispose();
  }

  //Breaks a string of messages into an array of messages and calls for each handleMessage.
  dispatch(message) {
    if (message) {
      if (message.includes("\n")) {
        for (const msg of message.split("\n")) {
          this.handleMessage(removeNewlineSymbol(msg));
        }
      } else {
        this.handleMessage(message);
      }
    }
  }

/*Functions only called from within class*/

  //Processes a message based on categories.
  handleMessage(message) {
    if (message) {
      const messageCategory = message.split(DELIMITER)[0];
      const msg = message.substring(messageCategory.length + DELIMITER.length);

      switch (messageCategory) {
        case 'UPDATEPOSITION':
          this.emitter.emit('update-position', msg);
          break;
        case 'UPDATETABLE':
          this.emitter.emit('update-table', msg);
          break;
        case 'PUSHONTOCALLSTACK':
          this.emitter.emit('push-onto-callstack', msg);
          break;
        case 'POPFROMCALLSTACK':
          this.emitter.emit('pop-from-callstack', msg);
          break;
        case 'CHECKVALUE':
          this.emitter.emit('check-value', msg);
          break;
      }
    }
  }

/*EventSubscription*/

  onUpdatePosition(callback) {
    return this.emitter.on('update-position', callback);
  }

  onUpdateTable(callback) {
    return this.emitter.on('update-table', callback);
  }

  onPushOntoCallstack(callback) {
    return this.emitter.on('push-onto-callstack', callback);
  }

  onPopFromCallstack(callback) {
    return this.emitter.on('pop-from-callstack', callback);
  }

  onCheckValue(callback) {
    return this.emitter.on('check-value', callback);
  }
}
