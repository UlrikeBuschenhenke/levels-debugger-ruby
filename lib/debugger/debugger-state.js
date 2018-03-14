'use-babel';

import callStackFromString from '../common/call-stack-factory';
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
    this.callStack;
  }

  getPosition() {
    this.position;
  }

  setPosition(position) {
    this.position = position;
  }

  isAutoStep() {
    this.autoStep;
  }

  isStepOverNextCall() {
    this.stepOverNextCall;
  }
}
