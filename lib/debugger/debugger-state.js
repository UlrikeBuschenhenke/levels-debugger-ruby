'use babel';

import Position            from '../common/position';

//Class for the state of the debugger.
export default class DebuggerState {

/*Functions called from outside class*/

  //Create new debugger state.
  constructor () {
    this.callStack = [];
    this.variableTable = [];
    this.position = new Position(1,1);
    this.autoStep = false;
    this.stepOverNextCall = false;
  }

  //Update State with another State.
  updateDebuggerState(otherState) {
    if (otherState) {
      this.callStack.concat(otherState.getCallStack());
      // TODO: variableTable kopieren
      this.position = otherState.getPosition();
      this.autoStep = otherState.isAutoStep();
      this.stepOverNextCall = otherState.isStepOverNextCall();
    }
  }

  //Test if CallStack is empty.
  isCallStackEmpty() {
    if (this.callStack.length == 0) {
      return true;
    }
    return false;
  }

/*Getter*/

  getCallStack() {
    return this.callStack;
  }

  getVariableTable() {
    return this.variableTable;
  }

  getPosition() {
    return this.position;
  }

  isStepOverNextCall() {
    return this.stepOverNextCall;
  }

  isAutoStep() {
    return this.autoStep;
  }

/*Setter*/

  setCallStack(callStack) {
    this.callStack = callStack;
  }

  setVariableTable(table) {
    this.variableTable = table;
  }

  setPosition(position) {
    this.position = position;
  }

  setStepOverNextCall(stepOverNextCall) {
    this.stepOverNextCall = stepOverNextCall;
  }

  setAutoStep(autoStep) {
    this.autoStep = autoStep;
  }
}
