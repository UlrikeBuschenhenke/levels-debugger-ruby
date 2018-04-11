'use babel';

import CallStackEntry             from '../common/call-stack-entry';
import {DELIMITER, ASSIGN_SYMBOL} from './message-utils';

export default class PushOntoCallStackMessage {
  constructor(message) {
    const msg = message.split(DELIMITER);
    this.methodName = msg[0];
    this.params = [];
    for (var i = 1; i < msg.length; i++) {
      if (msg[i].startsWith("DefiningClassId")) {
        this.definingClassId = msg[i];
        this.definingInstanceId = msg[i+1];
        break;
      } else {
        this.params.push(msg[i]);
      }
    }
  }

  getMethodName() {
    return this.methodName;
  }

  getParamString() {
    var paramString = "(";
    var n = this.params.length - 1;
    for (var i = 0; i < n; i++) {
      paramString = paramString + this.params[i] + ", ";
    }
    paramString = paramString + this.params[n] + ")";
    return paramString;
  }

  getDefiningClassId() {
    return this.definingClassId;
  }

  getDefiningInstanceId() {
    return this.definingInstanceId;
  }
}
