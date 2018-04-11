'use babel';

import {Emitter}         from 'atom';
import DebuggerState             from './debugger-state.js';

export default class Debugger {
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
    //TODO: handleAutoStepping realisieren.
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

  findVariableTableEntryByName(variableTable, entry) {
    for(var i = 0; i < variableTable.length; i++) {
      if (variableTable[i].getName()==entry.getName()) {
        return i;
      }
    }
    return -1;
  }

  getVariableTable() {
    return this.state.getVariableTable();
  }

  pushOntoCallStack(callStackEntry) {
    var callStack = this.state.getCallStack();
    callStack.unshift(callStackEntry);
    this.state.setCallStack(callStack);
  }

  popFromCallStack() {
    var callStack = this.state.getCallStack();
    callStack.shift();
    this.state.setCallStack(callStack);
  }

  getCallStack() {
    return this.state.getCallStack();
  }

  step() {

  }

  emitReady() {
    this.emitter.emit('debugger-ready');
  }

  emitStop() {
    this.emitter.emit('debugger-stop');
  }

  onReady(callback) {
    return this.emitter.on('debugger-ready', callback);
  }

  onStop(callback) {
    return this.emitter.on('debugger-stop', callback);
  }
}
