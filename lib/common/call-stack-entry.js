'use babel';

//Class representing an entry in the callstack.
export default class CallStackEntry {

/*Functions called from outside class*/

  //Create new CallStackEntry.
  constructor(methodAndArgs, methodName, params, definingClassId, definingInstanceId, callId) {
    this.methodAndArgs = methodAndArgs;
    this.methodName = methodName;
    this.params = params;
    this.definingClassId = definingClassId;
    this.definingInstanceId = definingInstanceId;
    this.callId = callId;
    this.marked = false;
  }

/*Getter*/

  getMethodAndArgs() {
    return this.methodAndArgs;
  }

  getMethodName() {
    return this.methodName;
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

  getCallId() {
    return this.callId;
  }

  isMarked() {
    return this.marked;
  }

/*Setter*/

  setMarked(marked) {
    this.marked = marked;
  }
}
