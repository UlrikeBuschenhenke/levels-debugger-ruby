'use babel';

import {Emitter}         from 'atom';
import DebuggerState     from './debugger-state.js';

//Class for the debugger logic.
export default class Debugger {

/*Functions called from outside class*/

  constructor() {
    this.emitter = new Emitter();
    this.state = new DebuggerState();
  }

  start() {
    this.emitReady();
  }

  stop() {
    this.emitStop();
    this.destroy();
  }

  destroy() {
    this.emitter.dispose();
  }

  updatePosition(message) {
    this.state.setPosition(message.getPosition());
    this.handleAutoStepping();
  }

  updateVariableTable(variableTableEntry) {
    var variableTable = this.state.getVariableTable();
    var entryIndex = this.findVariableTableEntryByName(variableTable,variableTableEntry);
    if (entryIndex!=-1) {
      variableTableEntry.setChanged(true);
      variableTable.splice(entryIndex,1,variableTableEntry);
    } else {
      variableTable.unshift(variableTableEntry);
    }
    this.state.setVariableTable(variableTable);
    return variableTable;
  }

  pushOntoCallStack(callStackEntry) {
    callStackEntry.setMarked(this.state.isStepOverNextCall());
    this.state.setStepOverNextCall(false);
    var callStack = this.state.getCallStack();
    callStack.unshift(callStackEntry);
    if (callStackEntry.isMarked()) {
      this.enableAutoStepping();
    }
    this.state.setCallStack(callStack);
    //VariableTable aktualisiern?
  }

  popFromCallStack() {
    var callStack = this.state.getCallStack();
    callStack.shift();
    this.state.setCallStack(callStack);
  }

  step() {

  }

  stepOver(stepOverNextCall) {
    this.state.setStepOverNextCall(stepOverNextCall);
  }

/*Functions only called from within class*/

  enableAutoStepping() {
    this.state.setAutoStep(true);
    this.emitAutoSteppingEnabled();
  }

  handleAutoStepping() {
    //if (this.isBreakpoint(this.state.getPosition()) && this.state.isAutoStep()) {
    //  this.disableAutoStepping();
    //} else
    if (this.state.isAutoStep()) {
      this.emitSendStepSignal();
    }
  }

  findVariableTableEntryByName(variableTable, entry) {
    for(var i = 0; i < variableTable.length; i++) {
      if (variableTable[i].getName()==entry.getName()) {
        return i;
      }
    }
    return -1;
  }

/*Getter*/

  getCallStack() {
    return this.state.getCallStack();
  }

  getVariableTable() {
    return this.state.getVariableTable();
  }

/*Notifier*/

  emitReady() {
    this.emitter.emit('debugger-ready');
  }

  emitStop() {
    this.emitter.emit('debugger-stop');
  }

  emitAutoSteppingEnabled() {
    this.emitter.emit('auto-stepping-enabled')
  }

  emitSendStepSignal() {
    this.emitter.emit('send-step-signal');
  }

/*Handler*/

  onReady(callback) {
    return this.emitter.on('debugger-ready', callback);
  }

  onStop(callback) {
    return this.emitter.on('debugger-stop', callback);
  }

  onAutoSteppingEnabled(callback) {
    return this.emitter.on('auto-stepping-enabled', callback);
  }

  onSendStepSignal(callback) {
    return this.emitter.on('send-step-signal', callback);
  }
}
