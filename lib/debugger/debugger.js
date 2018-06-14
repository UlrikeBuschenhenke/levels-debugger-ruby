'use babel';

import {Emitter}         from 'atom';
import BreakpointManager from '../common/breakpoint-manager';
import DebuggerState     from './debugger-state.js';
import Recorder          from '../replay/recorder.js';

//Class for the debugger logic.
export default class Debugger {

/*Functions called from outside class*/

  //Create new Debugger.
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

  //Start Debugger.
  start() {
    this.emitReady();
  }

  //Stop Debugger.
  stop() {
    this.state = new DebuggerState();
    this.recorder = new Recorder();
    this.emitStop();
  }

  //Destroy Debugger.
  destroy() {
    this.recorder.destroy();
    this.emitter.dispose();
  }

  //Updates the position and records the state.
  updatePosition(position) {
    this.setPosition(position);
    if (!this.isReplay) {
      var cloneState = new DebuggerState();
      cloneState.updateDebuggerState(this.state);
      this.recorder.recordState(cloneState);
    }
    this.handleAutoStepping();
  }

  //Updates the VariableTable with a entry.
  updateVariableTable(variableTableEntry) {
    const address = variableTableEntry.getAddress();
    const value = variableTableEntry.getValue();
    var variableTable = this.getVariableTable();
    var entryIndex = this.findVariableTableEntryByName(variableTable,variableTableEntry);
    if (entryIndex!=-1) {
      variableTableEntry.setChanged(true);
      variableTable.splice(entryIndex,1,variableTableEntry);
    } else {
      variableTable.unshift(variableTableEntry);
    }
    this.setVariableTable(variableTable);
    return variableTable;
  }

  //Check if a variablevalue has been changed.
  checkVariableValue(variableName, variableValue) {
    var variableTable = this.getVariableTable();
    for(var i = 0; i < variableTable.length; i++) {
      if (variableTable[i].getName()==variableName) {
        if (variableTable[i].getValue()!=variableValue) {
          variableTable[i].setValue(variableValue);
          variableTable[i].setChanged(true);
          this.setVariableTable(variableTable);
        }
        break;
      }
    }
  }

  //Push call onto callstack and records state as entrypoint.
  pushOntoCallStack(callStackEntry) {
    callStackEntry.setMarked(this.isStepOverNextCall());
    this.setStepOverNextCall(false);
    var callStack = this.getCallStack();
    callStack.unshift(callStackEntry);
    if (callStackEntry.isMarked()) {
      this.enableAutoStepping();
    }
    this.setCallStack(callStack);
    this.shadowTables.unshift(this.getVariableTable());
    this.setVariableTable([]);
    if (!this.isReplay) {
      this.recorder.recordEntryPoint(callStackEntry.getCallId());
    }
    this.emitUpdateTable();
  }

  //Pop from callstack.
  popFromCallStack() {
    var callStack = this.getCallStack();
    if (callStack[0].isMarked()) {
      this.emitEnablePositionMarker();
      this.disableAutoStepping();
    }
    callStack.shift();
    this.setCallStack(callStack);
    this.setVariableTable(this.shadowTables.shift());
    this.emitUpdateTable();
  }

  //Set stepOverNextCall in state.
  stepOver() {
    this.setStepOverNextCall(true);
  }

  //Updates the list of breakpoints.
  updateBreakpoints(breakpoints) {
    this.breakpoints = breakpoints;
  }

  //Enables the debugger to autostep.
  enableAutoStepping() {
    this.setAutoStep(true);
    this.emitAutoSteppingEnabled();
  }

  //Disables the debugger to autostep.
  disableAutoStepping() {
    this.setAutoStep(false);
    this.emitAutoSteppingDisabled();
  }

  //Enables the debugger to run to the end of a method call.
  runToEndOfMethod() {
    if (!this.isCallStackEmpty()) {
      var callStack = this.getCallStack();
      callStack[0].setMarked(true);
      this.setCallStack(callStack);
    }
  }

  //Starts the replay of a certain method call.
  startReplay(callId) {
    this.isReplay = true;
    this.shadowState = this.getState();
    this.setState(this.recorder.startReplay(callId));
    this.emitReplayState(this.getPosition());
    this.emitReplayStarted();
  }

  //Stops the currently active replay.
  stopReplay() {
    this.isReplay = false;
    this.setState(this.shadowState);
    this.emitReplayState(this.getPosition());
  }

  //Called if a step in the currently active replay is made.
  replayStep() {
    if (this.recorder.endOfTape()) {
      this.emitEndOfReplayTape();
    } else {
      this.setState(this.recorder.replayStep());
      this.emitReplayState(this.getPosition());
    }
  }

/*Functions only called from within class*/

  //Enables stepping without user input.
  handleAutoStepping() {
    if (this.breakpointManager.isBreakpoint(this.getPosition()) && this.isAutoStep()) {
      this.disableAutoStepping();
      this.emitEnablePositionMarker();
    } else if (this.isAutoStep()) {
      this.emitSendStepSignal();
      this.emitDisablePositionMarker();
    }
  }

  //Searches variable table for an certain entry by name. Returns index of entry.
  findVariableTableEntryByName(variableTable, entry) {
    for(var i = 0; i < variableTable.length; i++) {
      if (variableTable[i].getName()==entry.getName()) {
        return i;
      }
    }
    return -1;
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

  isStepOverNextCall() {
    return this.state.isStepOverNextCall();
  }
  isAutoStep() {
    return this.state.isAutoStep();
  }

/*Setter*/

  setState(state) {
    this.state = state;
  }

  setPosition(position) {
    this.state.setPosition(position);
  }

  setCallStack(callStack) {
    this.state.setCallStack(callStack);
  }

  setVariableTable(variableTable) {
    this.state.setVariableTable(variableTable);
  }

  setStepOverNextCall(stepOverNextCall) {
    this.state.setStepOverNextCall(stepOverNextCall);
  }

  setAutoStep(autoStep) {
    this.state.setAutoStep(autoStep);
  }

/*EventEmission*/

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

  emitEnablePositionMarker() {
    this.emitter.emit('enable-position-marker');
  }

  emitDisablePositionMarker() {
    this.emitter.emit('disable-position-marker');
  }

/*EventSubscription*/

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

  onEnablePositionMarker(callback) {
    return this.emitter.on('enable-position-marker', callback);
  }

  onDisablePositionMarker(callback) {
    return this.emitter.on('disable-position-marker', callback);
  }
}
