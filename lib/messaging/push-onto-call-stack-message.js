'use babel';

import CallStackEntry             from '../common/call-stack-entry';
import {DELIMITER, ASSIGN_SYMBOL} from './message-utils';

//Class for PushOntoCallStackMessage.
export default class PushOntoCallStackMessage {

/*Functions called from outside class*/

  //Create new PushOntoCallStackMessage.
  constructor(message, callId) {
    const msg = message.split(DELIMITER);
    this.methodName = msg[0];
    this.callId = callId;
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

/*Getter*/

  getMethodName() {
    return this.methodName;
  }

  getCallId() {
    return this.callId;
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

  getParams() {
    return this.params;
  }

  getDefiningClassId() {
    return this.definingClassId;
  }

  getDefiningInstanceId() {
    return this.definingInstanceId;
  }
}
