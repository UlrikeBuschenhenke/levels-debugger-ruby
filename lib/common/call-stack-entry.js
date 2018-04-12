'use babel';

export default class CallStackEntry {
  constructor(methodAndArgs, methodName, params, definingClassId, definingInstanceId, callId) {
    this.methodAndArgs = methodAndArgs;
    this.methodName = methodName;
    this.params = params;
    this.definingClassId = definingClassId;
    this.definingInstanceId = definingInstanceId;
    this.callId = callId;
    this.marked = false;
  }

  setMarked(marked) {
    this.marked = marked;
  }

  isMarked() {
    return this.marked;
  }

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
}
