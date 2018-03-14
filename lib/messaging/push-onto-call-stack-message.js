'use babel';

import {DELIMETER} from '.message-utils';

export default class PushOntoCallStackMessage {
  constructor(message) {
    var msg = message.split(DELIMETER);
    this.methodName = msg[1];
    //TODO: was passiert mit dem Rest??
  }
}
