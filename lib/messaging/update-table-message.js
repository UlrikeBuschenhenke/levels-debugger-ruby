'use babel';

import {DELIMETER} from './message-utils';

export default class UpdateTableMessage {
  constructor(message) {
    var msg = message.split(DELIMETER);
    this.variableName = msg[1];
    this.variableValue = msg[2];
    this.variableAddress = msg[3];
    //TODO: was passiert mit dem Rest??
  }

  getVariableName() {
    this.variableName;
  }

  getVariableValue() {
    this.variableValue;
  }

  getVariableAddress() {
    this.variableAddress;
  }
}
