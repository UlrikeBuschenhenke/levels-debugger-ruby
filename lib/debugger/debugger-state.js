'use babel';

import Position            from '../common/position';

export default class DebuggerState {
  constructor () {
    this.callStack = [];
    this.variableTable = [];
    this.position = new Position(1,1);
    this.autoStep = false;
    this.stepOverNextCall = false;
  }

  updateDebuggerState(otherState) {
    if (otherState) {
      this.callStack.concat(otherState.getCallStack());
      // TODO: variableTable kopieren
      this.position = otherState.getPosition();
      this.autoStep = otherState.isAutoStep();
      this.stepOverNextCall = otherState.isStepOverNextCall();
    }
  }

  getCallStack() {
    return this.callStack;
  }

  setCallStack(callStack) {
    this.callStack = callStack;
  }

  getVariableTable() {
    return this.variableTable;
  }

  setVariableTable(table) {
    this.variableTable = table;
  }

  updateVariableTable(tableEntry) {
    this.variableTable.unshift(tableEntry);
  }

  getPosition() {
    return this.position;
  }

  setPosition(position) {
    this.position = position;
  }

  isAutoStep() {
    return this.autoStep;
  }

  isStepOverNextCall() {
    return this.stepOverNextCall;
  }
}
