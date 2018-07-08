'use babel';

import {Emitter}                from 'atom';
import variableTableManager     from '../common/variable-table-manager';
import callStackEntryFromString from '../common/call-stack-factory';
import BreakpointManager        from '../common/breakpoint-manager';
import DebuggerState            from './debugger-state.js';
import Recorder                 from '../replay/recorder.js';

//Class for the debugger logic.
export default class Debugger {

  /*Functions called from outside class*/

  //Create new Debugger.
  constructor() {
    this.emitter = new Emitter();
    this.state = new DebuggerState();
    this.breakpoints = [];
    this.breakpointManager = new BreakpointManager();
    this.shadowTables = [];
    this.recorder = new Recorder();
    this.shadowState = new DebuggerState();
    this.isReplay = false;
  }

  //Destroy Debugger.
  destroy() {
    this.recorder.destroy();
    this.emitter.dispose();
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

  //Set stepOverNextCall in state.
  stepOver() {
    this.setStepOverNextCall(true);
  }

  //Enables the debugger to run to the end of a method call.
  runToEndOfMethod() {
    if (!this.isCallStackEmpty()) {
      var callStack = this.getCallStack();
      callStack[0].setMarked(true);
      this.setCallStack(callStack);
    }
  }

  //Sets a new or removes an existing breakpoint.
  toggleBreakpoint(point) {
    this.breakpointManager.toggle(point);
  }

  //Removes all existing breakpoints.
  removeAllBreakpoints() {
    this.breakpointManager.removeAll();
  }

  //Enables/Disables the existing breakpoints.
  enableDisableAllBreakpoints() {
    this.breakpointManager.flip();
  }

  //Starts the replay of a certain method call.
  startReplay(callId) {
    const position = this.getPosition()
    this.isReplay = true;
    this.shadowState = this.cloneState();
    this.state = this.recorder.startReplay(callId);
    this.emitPositionUpdated(position);
    this.emitReplayStarted();
  }

  //Stops the currently active replay.
  stopReplay() {
    this.isReplay = false;
    this.setState(this.shadowState);
    this.emitPositionUpdated(this.getPosition());
  }

  //Called if a step in the currently active replay is made.
  replayStep() {
    if (this.recorder.endOfTape()) {
      this.emitEndOfReplayTape();
    } else {
      this.setState(this.recorder.replayStep());
      this.emitPositionUpdated(this.getPosition());
    }
  }

  //Called if a run to next breakpoint in the currently active replay is made.
  replayRunToNextBreakpoint() {
    if (this.recorder.endOfTape()) {
      this.emitEndOfReplayTape();
    } else {
      const state = this.recorder.replayStep();
      if (this.breakpointManager.isBreakpoint(this.getPosition())){
        this.setState(this.recorder.replayStep());
        this.emitPositionUpdated(this.getPosition());
      } else {
        this.replayRunToNextBreakpoint();
      }

    }
  }

  /*Called for incoming messages*/

  //Updates the position and records the state.
  updatePosition(msg) {
    const position = msg.getPosition();
    this.setPosition(position);
    if (!this.isReplay) {
      const cloneState = this.cloneState();
      this.recorder.recordState(cloneState);
    }
    this.handleAutoStepping();
    this.emitPositionUpdated(position);
  }

  //Updates the VariableTable with a entry.
  updateVariableTable(msg) {
    const oldTable = this.getVariableTable();
    const variableTableEntry = variableTableManager.variableTableEntryFromString(msg);
    const address = variableTableEntry.getAddress();
    const value = variableTableEntry.getValue();
    var newTable = this.getVariableTable();
    var entryIndex = this.findVariableTableEntryByName(newTable,variableTableEntry);
    if (entryIndex!=-1) {
      variableTableEntry.setChanged(true);
      newTable.splice(entryIndex,1,variableTableEntry);
    } else {
      newTable.unshift(variableTableEntry);
    }
    variableTableManager.sort(newTable);
    variableTableManager.markChangedEntries(newTable, oldTable);
    this.setVariableTable(newTable);
  }

  //Check if a variableValue has been changed.
  checkVariableValue(msg) {
    const variableName = msg.getVariableName();
    const variableValue = msg.getVariableValue();
    var variableTable = this.getVariableTable();
    for(var i = 0; i < variableTable.length; i++) {
      if (variableTable[i].getName()==variableName) {
        if (variableTable[i].getValue()!=variableValue) {
          variableTable[i].setValue(variableValue);
          variableTable[i].setChanged(true);
          this.checkVariableValueOtherScopes(variableTable[i].getAddress(), variableValue);
          this.setVariableTable(variableTable);
        }
        break;
      }
    }
  }

  //Push call onto callstack and records state as entrypoint.
  pushOntoCallStack(msg) {
    const callStackEntry = callStackEntryFromString(msg);
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
  }

  //Pop from callstack.
  popFromCallStack() {
    var callStack = this.getCallStack();
    if (!this.isCallStackEmpty()){
      if (callStack[0].isMarked()) {
        this.emitEnablePositionMarker();
        this.disableAutoStepping();
      }
      callStack.shift();
      this.setCallStack(callStack);
      this.setVariableTable(this.shadowTables.shift());
    }
  }

  /*VariableTableManager*/

  //Resorts the variableTable.
  flipAndSortVariableTable() {
    variableTableManager.flipSortMode();
    variableTableManager.sort(this.getVariableTable());
  }

  //Reset sort mode for the variabelTable.
  resetSortModeVariableTable() {
    variableTableManager.resetSortMode();
  }

  /*BreakpointManager*/

  //Restores a hidden breakpoint.
  restoreHiddenBreakpoint() {
    this.breakpointManager.restoreHiddenBreakpoint();
  }

  //Hides a breakpoint at a certain position.
  hideBreakpoint(position) {
    this.breakpointManager.hideBreakpoint(position);
  }

  /*Autostepping*/

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

  //Check if a varaibleValue has been Changed in other Scopes.
  checkVariableValueOtherScopes(variableAddress, variableValue) {
    for(var j = 0; j < this.shadowTables.length; j++) {
      for(var i = 0; i < this.shadowTables[j].length; i++) {
        if (this.shadowTables[j][i].getAddress()==variableAddress) {
          if (this.shadowTables[j][i].getValue()!=variableValue) {
            this.shadowTables[j][i].setValue(variableValue);
            this.shadowTables[j][i].setChanged(true);
          }
          break;
        }
      }
    }
  }

  //Clones the current state of the debugger.
  cloneState() {
    var cloneState = new DebuggerState()
    const variableTable = this.getVariableTable();
    const callStack = this.getCallStack();
    const cloneVariableTable = [].concat(variableTable);
    const cloneCallStack = [].concat(callStack);
    cloneState.setVariableTable(cloneVariableTable);
    cloneState.setCallStack(cloneCallStack);
    cloneState.setStepOverNextCall(this.isStepOverNextCall());
    cloneState.setAutoStep(this.isAutoStep());
    cloneState.setPositionLineColumn(this.getPosition().getLine(), this.getPosition().getColumn());
    return cloneState;
  }

  /*Getter*/

  getState() {
    return this.state;
  }

  getPosition() {
    return this.state.getPosition();
  }

  getCallStack() {
    if (this.state.getCallStack() != nil) {
      return this.state.getCallStack();
    } else {
      return [];
    }
  }

  getVariableTable() {
    if (this.state.getVariableTable() != nil) {
      return this.state.getVariableTable();
    } else {
      return [];
    }
  }

  getAreBreakpointsEnabled() {
    return this.breakpointManager.getAreBreakpointsEnabled();
  }

  getBreakpoints() {
    return this.breakpointManager.getBreakpoints();
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

  emitPositionUpdated(position) {
    this.emitter.emit('position-updated', position);
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

  onPositionUpdated(callback) {
    return this.emitter.on('position-updated', callback)
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
