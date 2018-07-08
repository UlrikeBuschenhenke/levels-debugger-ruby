'use babel';

import {DELIMITER} from './message-utils';

//Class for CheckValueMessage.
export default class CheckValueMessage {

/*Functions called from outside class*/

  //Create new CheckValueMessage.
  constructor(message) {
    const msg = message.split(DELIMITER);
    this.variableName = msg[0];
    this.variableValue = msg[1];
  }

/*Getter*/

  getVariableName() {
    return this.variableName;
  }

  getVariableValue() {
    return this.variableValue;
  }
}
