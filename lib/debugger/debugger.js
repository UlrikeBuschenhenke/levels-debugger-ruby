'use babel';

import {Emitter}         from 'atom';
import BreakpointManager from '../common/breakpoint-manager';
import DebuggerState     from './debugger-state.js';
import Recorder          from '../replay/recorder.js';

//Class for the debugger logic.
export default class Debugger {

/*Functions called from outside class*/

  constructor(breakpointManager) {
    this.emitter = new Emitter();
    this.state = new DebuggerState();
    this.breakpoints = [];
    this.breakpointManager = breakpointManager;
    this.shadowTables = [];
    this.recorder = new Recorder();
    this.shadowState = new DebuggerState();
    this.isReplay = false;
  }

  start() {
    this.emitReady();
  }

  stop() {
    this.state = new DebuggerState();
    this.recorder = new Recorder();
    this.emitStop();
  }

  destroy() {
    this.recorder.destroy();
    this.emitter.dispose();
  }

  updatePosition(position) {
    this.state.setPosition(position);
    if (!this.isReplay) {
      var cloneState = new DebuggerState();
      cloneState.updateDebuggerState(this.state);
      this.recorder.recordState(cloneState);
    }
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
    this.setVariableTable(variableTable);
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
    this.setCallStack(callStack);
    this.shadowTables.unshift(this.state.getVariableTable());
    this.setVariableTable([]);
    if (!this.isReplay) {
      this.recorder.recordEntryPoint(callStackEntry.getCallId());
    }
    this.emitUpdateTable();
  }

  popFromCallStack() {
    var callStack = this.state.getCallStack();
    callStack.shift();
    this.setCallStack(callStack);
    this.setVariableTable(this.shadowTables.shift());
    this.emitUpdateTable();
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
      this.setCallStack(cs);
    }
  }

  startReplay(callId) {
    this.isReplay = true;
    this.shadowState = this.getState();
    this.setState(this.recorder.startReplay(callId));
    this.emitReplayState(this.getPosition());
    this.emitReplayStarted();
  }

  stopReplay() {
    this.isReplay = false;
    this.setState(this.shadowState);
    this.emitReplayState(this.getPosition());
  }

  replayStep() {
    if (this.recorder.endOfTape()) {
      this.emitEndOfReplayTape();
    } else {
      this.setState(this.recorder.replayStep());
      this.emitReplayState(this.getPosition());
    }
  }

/*Functions only called from within class*/

  handleAutoStepping() {
    if (this.breakpointManager.isBreakpoint(this.getPosition()) && this.state.isAutoStep()) {
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
    this.setVariableTable(variableTable);
  }

/*Getter*/

  getState() {
    return this.state;
  }

  getPosition() {
    return this.state.getPosition();
  }

  getCallStack() {
    return this.state.getCallStack();
  }

  getVariableTable() {
    return this.state.getVariableTable();
  }

  isCallStackEmpty() {
    return this.state.isCallStackEmpty();
  }

/*Setter*/

  setState(state) {
    this.state = state;
  }

  setCallStack(callStack) {
    this.state.setCallStack(callStack);
  }

  setVariableTable(variableTable) {
    this.state.setVariableTable(variableTable);
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

  emitUpdateTable() {
    this.emitter.emit('update-table');
  }

  emitReplayStarted() {
    this.emitter.emit('replay-started');
  }

  emitReplayState(position) {
    this.emitter.emit('replay-state', position);
  }

  emitEndOfReplayTape() {
    this.emitter.emit('end-of-replay-tape');
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

  onUpdateTable(callback) {
    return this.emitter.on('update-table', callback);
  }

  onReplayStarted(callback) {
    return this.emitter.on('replay-started', callback);
  }

  onReplayState(callback) {
    return this.emitter.on('replay-state', callback);
  }

  onEndOfReplayTape(callback) {
    return this.emitter.on('end-of-replay-tape', callback);
  }
}
