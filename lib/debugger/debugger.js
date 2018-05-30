'use babel';

import {Emitter}         from 'atom';
import BreakpointManager from '../common/breakpoint-manager';
import DebuggerState     from './debugger-state.js';

//Class for the debugger logic.
export default class Debugger {

/*Functions called from outside class*/

  constructor(breakpointManager) {
    this.emitter = new Emitter();
    this.state = new DebuggerState();
    this.breakpoints = [];
    this.breakpointManager = breakpointManager;
  }

  start() {
    this.emitReady();
  }

  stop() {
    this.state = new DebuggerState();
    this.emitStop();
  }

  destroy() {
    this.emitter.dispose();
  }

  updatePosition(position) {
    this.state.setPosition(position);
    this.handleAutoStepping();
  }

  updateVariableTable(variableTableEntry) {
    const address = variableTableEntry.getAddress();
    const value = variableTableEntry.getValue();
    var variableTable = this.state.getVariableTable();
    var entryIndex = this.findVariableTableEntryByName(variableTable,variableTableEntry);
    if (entryIndex!=-1) {
      variableTableEntry.setChanged(true);
      variableTable.splice(entryIndex,1,variableTableEntry);
    } else {
      variableTable.unshift(variableTableEntry);
    }
    this.updateAllWithSameAddress(address, value);
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

  updateBreakpoints(breakpoints) {
    this.breakpoints = breakpoints;
  }

  enableAutoStepping() {
    this.state.setAutoStep(true);
    this.emitAutoSteppingEnabled();
  }

  disableAutoStepping() {
    this.state.setAutoStep(false);
    this.emitAutoSteppingDisabled();
  }

  runToEndOfMethod() {
    if (this.isCallStackEmpty()) {
      cs[0].setMarked = true;
      this.state.setCallStack(cs);
    }
  }

  isCallStackEmpty() {
    return this.state.isCallStackEmpty();
  }

/*Functions only called from within class*/

  handleAutoStepping() {
    if (this.breakpointManager.isBreakpoint(this.state.getPosition()) && this.state.isAutoStep()) {
      this.disableAutoStepping();
    } else if (this.state.isAutoStep()) {
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

  updateAllWithSameAddress(address, value) {
    var variableTable = this.state.getVariableTable();
    for(var i = 0; i < variableTable.length; i++) {
      if (variableTable[i].getAddress()==address) {
        variableTable[i].setValue(value);
        variableTable[i].setChanged(true);
      }
    }
    this.state.setVariableTable(variableTable);
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

  emitAutoSteppingDisabled() {
    this.emitter.emit('auto-stepping-disabled');
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

  onAutoSteppingDisabled(callback) {
    return this.emitter.on('auto-stepping-disabled', callback);
  }

  onSendStepSignal(callback) {
    return this.emitter.on('send-step-signal', callback);
  }
}
