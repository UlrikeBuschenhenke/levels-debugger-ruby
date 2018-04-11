'use babel';

import {Emitter}                                      from 'atom';
import {DELIMITER, FINAL_SYMBOL, removeNewlineSymbol} from './message-utils';

export default class IncomingMessageDispatcher {
  constructor() {
    this.emitter = new Emitter();
  }

  destroy() {
    this.emitter.dispose();
  }

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

  handleMessage(message) {
    if (message) {
      const messageCategory = message.split(DELIMITER)[0];
      const msg = message.substring(messageCategory.length + DELIMITER.length);

      switch (messageCategory) {
        case 'UPDATEPOSITION':
          this.emitter.emit('update-position', msg);
          //alert(message);
          break;
        case 'UPDATETABLE':
          this.emitter.emit('update-table', msg);
          //alert(message);
          break;
        case 'PUSHONTOCALLSTACK':
          this.emitter.emit('push-onto-callstack', msg);
          //alert(message);
          break;
        case 'POPFROMCALLSTACK':
          this.emitter.emit('pop-from-callstack', msg);
          //alert(message);
          break;
        default: alert(message);
      }
    }
  }

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
}
