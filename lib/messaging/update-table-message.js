'use babel';

import VariableTableEntry         from '../common/variable-table-entry';
import {DELIMITER, ASSIGN_SYMBOL} from './message-utils';

export default class UpdateTableMessage {
  constructor(message) {
    const msg = message.split(DELIMITER);
    this.variable = msg[0] + ASSIGN_SYMBOL + msg[1] + ASSIGN_SYMBOL + msg[2] + DELIMITER;
    this.variableName = msg[0];
    this.variableValue = msg[1];
    this.variableAddress = msg[2];
    this.scopeType = msg[3].split(ASSIGN_SYMBOL)[1];
    this.definingClassId = msg[4].split(ASSIGN_SYMBOL)[1];
    this.definingInstanceId = msg[5].split(ASSIGN_SYMBOL)[1];
  }

  getTableEntry() {
    return new VariableTableEntry(this.variableName, this.variableValue, this.variableAddress);
  }

  getVariable() {
    return this.variable;
  }

  getVariableName() {
    return this.variableName;
  }

  getVariableValue() {
    return this.variableValue;
  }

  getVariableAddress() {
    return this.variableAddress;
  }

  getScopeType() {
    return this.scopeType;
  }

  getDefiningClassId() {
    return this.definingClassId;
  }

  getDefiningInstanceId() {
    return this.definingInstanceId;
  }
}
