'use babel';

import {CompositeDisposable, Emitter} from 'atom';
import BreakpointManager              from '../common/breakpoint-manager';
import callStackEntryFromString       from '../common/call-stack-factory';
import levelsWorkspaceManager         from '../common/levels-workspace-manager';
import Position                       from '../common/position';
import {fromPoint, toPoint}           from '../common/position-utils';
import * as statusUpdateEventFactory  from '../common/status-update-event-factory';
import variableTableManager           from '../common/variable-table-manager';
import Debugger                       from '../debugger/debugger';
import {DELIMITER, ASSIGN_SYMBOL}     from '../messaging/message-utils';
import * as outgoingMessageFactory    from '../messaging/outgoing-message-factory';
import UpdatePositionMessage          from '../messaging/update-position-message';
import UpdateTableMessage             from '../messaging/update-table-message';
import PushOntoCallStackMessage       from '../messaging/push-onto-call-stack-message';

//
export default class DebuggerPresenter {
  constructor(incomingMessageDispatcher, socketChannel) {
    this.incomingMessageDispatcher = incomingMessageDispatcher;
    this.socketChannel = socketChannel;
    this.breakpointManager = new BreakpointManager();
    this.debugger = new Debugger(this.breakpointManager);
    this.emitter = new Emitter();

    this.callStack = [];
    this.variableTable = [];
    this.positionMarker = null;
    this.isReplay = false;
    this.isExecutableInDebuggingMode = false;
    this.isAutoSteppingEnabled = true;
    this.areAllControlsDisabled = false;
    this.autoRunActive = false;

    this.callId = 0;

    this.currentStatusEvent = statusUpdateEventFactory.createStopped(false);
    this.lastEventBeforeDisabling = this.currentStatusEvent;
    this.lastEventBeforeReplay = null;

    this.execSubscriptions = null;

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(this.debugger.onReady(() => this.startExecutableAndConnect()));
    this.subscriptions.add(this.debugger.onStop(() => this.handleStop()));
    this.subscriptions.add(this.debugger.onAutoSteppingEnabled(() => this.emitAutoSteppingEnabled()));
    this.subscriptions.add(this.debugger.onAutoSteppingDisabled(() => this.emitAutoSteppingDisabled()));
    this.subscriptions.add(this.debugger.onSendStepSignal(() => this.sendStepSignal()));
    this.subscriptions.add(this.debugger.onUpdateTable(() => this.updateVariableTable()));
    this.subscriptions.add(this.debugger.onReplayStarted(() => this.emitReplayStarted()));
    this.subscriptions.add(this.debugger.onReplayState(position => this.emitPositionUpdated(position)));
    this.subscriptions.add(this.debugger.onEndOfReplayTape(() => this.handleEndOfReplayTape()));
    this.subscriptions.add(levelsWorkspaceManager.onWorkspaceAttached(workspace => this.setLevelsWorkspace(workspace)));
    this.subscriptions.add(this.socketChannel.onError(() => this.handleChannelError()));
    this.subscriptions.add(this.incomingMessageDispatcher.onUpdatePosition(message => this.updatePosition(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onUpdateTable(message => this.updateTable(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onPushOntoCallstack(message => this.pushOntoCallstack(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onPopFromCallstack(message => this.popFromCallstack(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onCheckValue(message => this.checkVariableValue(message)));
  }

  updatePosition(message) {
    const msg = message.split(DELIMITER);
    const position = new Position(parseInt(msg[0]), parseInt(msg[1]));
    this.debugger.updatePosition(position);
    this.emitPositionUpdated(position);
  }

  updateTable(message) {
    const msg = new UpdateTableMessage(message);
    const oldTable = this.debugger.getVariableTable();
    const newTable = this.debugger.updateVariableTable(variableTableManager.variableTableEntryFromString(msg));
    variableTableManager.sort(newTable);
    variableTableManager.markChangedEntries(newTable, oldTable);
    this.updateVariableTable();
  }

  pushOntoCallstack(message) {
    const msg = new PushOntoCallStackMessage(message, this.callId);
    this.debugger.pushOntoCallStack(callStackEntryFromString(msg));
    this.callId = this.callId + 1;
    this.updateCallStack();
  }

  popFromCallstack(message) {
    this.debugger.popFromCallStack();
    this.updateCallStack();
    this.autoRunActive = false;
    this.debugger.disableAutoStepping();
  }

  checkVariableValue(message) {
    const msg = message.split(DELIMITER);
    this.debugger.checkVariableValue(msg[0], msg[1]);
  }

  destroy() {
    this.disconnectAndCleanup();
    this.debugger.destroy();
    this.subscriptions.dispose();
    if (this.execSubscriptions) {
      this.execSubscriptions.dispose();
    }
  }

  initDebuggerView() {
    const isAutoSteppingEnabled = this.isAutoSteppingEnabled;

    this.emitEnableDisableAllBreakpoints();
    this.emitStatusUpdated(this.currentStatusEvent);
    this.emitEnableDisableAllControls(!this.areAllControlsDisabled);

    if (this.isExecutableInDebuggingMode) {
      this.emitRunning();
      this.emitVariableTableUpdated();
      this.emitCallStackUpdated();

      if (isAutoSteppingEnabled) {
        this.emitAutoSteppingEnabled();
      } else {
        this.emitAutoSteppingDisabled();
      }

      if (this.isReplay) {
        this.emitReplayStarted();
      }
    }
  }

  disconnectAndCleanup() {
    this.socketChannel.disconnect();
    this.isExecutableInDebuggingMode = false;
    this.debugger.stop();
    this.stopExecutable();
  }

  setLevelsWorkspace(workspace) {
    this.subscriptions.add(workspace.onDidEnterWorkspace(() => this.handleWorkspaceEntered()));
    this.subscriptions.add(workspace.onDidExitWorkspace(() => this.handleWorkspaceExited()));
    this.subscriptions.add(workspace.onDidChangeActiveLevel(() => this.handleLevelChanged()));
    this.subscriptions.add(workspace.onDidChangeActiveLevelCodeEditor(() => this.handleLevelCodeEditorChanged()));

    if (!levelsWorkspaceManager.isActive()) {
      this.handleLevelChanged();
    }
  }

  startDebugging() {
    if (!this.areAllControlsDisabled && !this.isExecutableInDebuggingMode) {
      const textEditor = levelsWorkspaceManager.getActiveTextEditor();

      if (textEditor) {
        const path = textEditor.getPath();
        const startDebuggerAction = () => {
          const terminal = levelsWorkspaceManager.getActiveTerminal();
          terminal.show();
          terminal.focus();

          this.debugger.start();
        };

        if (path) {
          textEditor.saveAs(path).then(startDebuggerAction);
        } else {
          const textEditorPaneContainer = atom.workspace.paneContainerForItem(textEditor);
          textEditorPaneContainer.getActivePane().saveItemAs(textEditor, error => {
            if (!error) {
              startDebuggerAction();
            }
          });
        }
      }
    }
  }

  startExecutableAndConnect() {
    this.socketChannel.connect();
    this.isExecutableInDebuggingMode = true;
    this.debuggingEditorId = levelsWorkspaceManager.getActiveLevelCodeEditor().getId();
    this.startExecutable();
    this.handleReady();
  }

  stopDebugging() {
    if (!this.areAllControlsDisabled && this.isExecutableInDebuggingMode) {
      this.disconnectAndCleanup();
    }
  }

  step() {
    if (this.areSteppingCommandsEnabled()) {
      this.emitStatusUpdated(statusUpdateEventFactory.createRunning(this.isReplay));
      if (this.isReplay) {
        this.debugger.replayStep();
      } else {
        this.sendStepSignal();
      }
    }
  }

  stepOver() {
    if (this.areSteppingCommandsEnabled()) {
      this.autoRunActive = true;
      this.emitStatusUpdated(statusUpdateEventFactory.createRunning(this.isReplay));
      this.debugger.stepOver(true);
      this.debugger.enableAutoStepping();
      this.sendStepSignal();
    }
  }

  sendStepSignal() {
    this.socketChannel.sendMessage(outgoingMessageFactory.createStepMessage());
  }

  toggleBreakpoint() {
    if (!this.areAllControlsDisabled) {
      for (const point of levelsWorkspaceManager.getActiveTextEditorCursorPositions()) {
        this.breakpointManager.toggle(point);
        this.debugger.updateBreakpoints(this.breakpointManager.getBreakpoints());
      }
    }
  }

  removeAllBreakpoints() {
    if (!this.areAllControlsDisabled) {
      this.breakpointManager.removeAll();
      this.debugger.updateBreakpoints(this.breakpointManager.getBreakpoints());
    }
  }

  enableDisableAllBreakpoints() {
    if (!this.areAllControlsDisabled) {
      this.breakpointManager.flip();
      this.emitEnableDisableAllBreakpoints();
    }
  }

  runToNextBreakpoint() {
    if (this.areSteppingCommandsEnabled()) {
      this.autoRunActive = true;
      this.emitStatusUpdated(statusUpdateEventFactory.createRunning(this.isReplay));
      this.debugger.enableAutoStepping();
      this.sendStepSignal();
    }
  }

  runToEndOfMethod() {
    if (this.areSteppingCommandsEnabled() && !this.debugger.isCallStackEmpty()) {
      this.autoRunActive = true;
      this.emitStatusUpdated(statusUpdateEventFactory.createRunning(this.isReplay));
      this.debugger.runToEndOfMethod();
      this.debugger.enableAutoStepping();
      this.sendStepSignal();
    }
  }

  startReplay(element) {
    if (!this.areAllControlsDisabled && this.isExecutableInDebuggingMode && (this.currentStatusEvent.getStatus() !== statusUpdateEventFactory.RUNNING_STATUS)) {

      if (!this.isReplay && (this.currentStatusEvent.getStatus() !== statusUpdateEventFactory.END_OF_TAPE_STATUS)) {
        this.lastEventBeforeReplay = this.currentStatusEvent;
      }
      this.isReplay = true;
      this.debugger.startReplay(element.dataset.callId);
    }
  }

  stopReplay() {
    if (!this.areAllControlsDisabled && this.isReplay) {
      this.debugger.stopReplay();
      this.isReplay = false;
      this.emitReplayStopped();
      this.emitStatusUpdated(this.lastEventBeforeReplay);
    }
  }

  areSteppingCommandsEnabled() {
    return !this.areAllControlsDisabled && this.isExecutableInDebuggingMode && !this.isAutoSteppingEnabled;
  }

  updateVariableTable() {
    this.variableTable = this.debugger.getVariableTable();
    if (!this.autoRunActive) {
      this.emitVariableTableUpdated();
    }
  }

  getVariableTable() {
    return this.variableTable;
  }

  updateCallStack() {
    this.callStack = this.debugger.getCallStack();
    if (!this.autoRunActive) {
      this.emitCallStackUpdated();
    }
  }

  getCallStack() {
    return this.callStack;
  }

  startExecutable() {
    levelsWorkspaceManager.getActiveLevelCodeEditor().startExecution({runExecArgs: ['-d']});
  }

  stopExecutable() {
    levelsWorkspaceManager.getActiveLevelCodeEditor().stopExecution();
  }

  flipAndSortVariableTable() {
    if (!this.areAllControlsDisabled && this.isExecutableInDebuggingMode) {
      variableTableManager.flipSortMode();
      variableTableManager.sort(this.variableTable);
      this.emitVariableTableUpdated();
    }
  }

  onRunning(callback) {
    return this.emitter.on('running', callback);
  }

  onStopped(callback) {
    return this.emitter.on('stopped', callback);
  }

  onPositionUpdated(callback) {
    return this.emitter.on('position-updated', callback);
  }

  onCallStackUpdated(callback) {
    return this.emitter.on('call-stack-updated', callback);
  }

  onVariableTableUpdated(callback) {
    return this.emitter.on('variable-table-updated', callback);
  }

  onStatusUpdated(callback) {
    return this.emitter.on('status-updated', callback);
  }

  onAutoSteppingEnabled(callback) {
    return this.emitter.on('auto-stepping-enabled', callback);
  }

  onAutoSteppingDisabled(callback) {
    return this.emitter.on('auto-stepping-disabled', callback);
  }

  onEnableDisableAllBreakpoints(callback) {
    return this.emitter.on('enable-disable-all-breakpoints', callback);
  }

  onEnableDisableAllControls(callback) {
    return this.emitter.on('enable-disable-all-controls', callback);
  }

  onReplayStarted(callback) {
    return this.emitter.on('replay-started', callback);
  }

  onReplayStopped(callback) {
    return this.emitter.on('replay-stopped', callback);
  }

  emitRunning() {
    this.emitter.emit('running');
  }

  emitStopped() {
    this.emitter.emit('stopped');
  }

  emitPositionUpdated(currentPosition) {
    const point = toPoint(currentPosition);

    if (this.breakpointManager.isBreakpoint(currentPosition)) {
      this.autoRunActive = false;
      this.updateVariableTable();
      this.emitCallStackUpdated();
    }

    this.breakpointManager.restoreHiddenBreakpoint();
    this.breakpointManager.hideBreakpoint(currentPosition);

    if (!this.autoRunActive) {
      if (this.positionMarker) {
        this.positionMarker.destroy();
      }
      this.positionMarker = levelsWorkspaceManager.addPositionMarker(point);
    }

    this.emitter.emit('position-updated', currentPosition);
    this.emitStatusUpdated(statusUpdateEventFactory.createWaiting(this.isReplay));

    const textEditor = levelsWorkspaceManager.getActiveTextEditor();
    if (textEditor) {
      textEditor.scrollToBufferPosition(point);
    }
  }

  emitCallStackUpdated() {
    this.emitter.emit('call-stack-updated');
  }

  emitVariableTableUpdated() {
    this.emitter.emit('variable-table-updated');
  }

  emitStatusUpdated(event) {
    this.emitter.emit('status-updated', event);
    this.currentStatusEvent = event;
    if (event.isBlockingStatus()) {
      this.emitAutoSteppingEnabled();
    } else {
      this.emitAutoSteppingDisabled();
    }
  }

  emitAutoSteppingEnabled() {
    this.isAutoSteppingEnabled = true;
    this.emitter.emit('auto-stepping-enabled');
  }

  emitAutoSteppingDisabled() {
    this.isAutoSteppingEnabled = false;
    this.emitter.emit('auto-stepping-disabled');
  }

  emitEnableDisableAllBreakpoints() {
    this.emitter.emit('enable-disable-all-breakpoints', this.breakpointManager.getAreBreakpointsEnabled());
  }

  emitEnableDisableAllControls(enabled) {
    this.areAllControlsDisabled = !enabled;
    this.emitter.emit('enable-disable-all-controls', enabled);
  }

  emitReplayStarted() {
    this.emitter.emit('replay-started');
  }

  emitReplayStopped() {
    this.emitter.emit('replay-stopped');
  }

  handleChannelError() {
    this.disconnectAndCleanup();
  }

  handleExecutableStarted() {
    if (!this.isExecutableInDebuggingMode) {
      this.emitEnableDisableAllControls(false);
    }
  }

  handleExecutableStopped() {
    if (this.isExecutableInDebuggingMode) {
      this.disconnectAndCleanup();
    }
    this.emitEnableDisableAllControls(levelsWorkspaceManager.isActiveLevelDebuggable());
  }

  handleReady() {
    this.emitRunning();
    this.emitAutoSteppingDisabled();
    for (const bp of this.breakpointManager.getBreakpoints()) {
      this.socketChannel.sendMessage(outgoingMessageFactory.createAddBreakpointMessage(bp.getPosition()));
    }
  }

  handleStop() {
    if (this.isExecutableInDebuggingMode) {
      this.disconnectAndCleanup();
    }

    this.isReplay = false;
    this.isAutoSteppingEnabled = true;
    this.variableTable = [];
    this.callStack = [];
    variableTableManager.resetSortMode();
    this.emitStopped();
    this.emitAutoSteppingEnabled();

    if (this.positionMarker) {
      this.positionMarker.destroy();
    }
    this.breakpointManager.restoreHiddenBreakpoint();

    this.emitStatusUpdated(statusUpdateEventFactory.createStopped(this.isReplay));
  }

  handleEndOfReplayTape() {
    this.emitStatusUpdated(statusUpdateEventFactory.createEndOfTape(false));
  }

  handleWorkspaceEntered() {
    const editor = levelsWorkspaceManager.getActiveLevelCodeEditor();

    if (this.isExecutableInDebuggingMode) {
      const enabled = this.debuggingEditorId === editor.getId();
      this.emitEnableDisableAllControls(enabled);
    } else {
      this.handleLevelChanged();

      this.execSubscriptions = new CompositeDisposable();
      this.execSubscriptions.add(editor.onDidStartExecution(() => this.handleExecutableStarted()));
      this.execSubscriptions.add(editor.onDidStopExecution(() => this.handleExecutableStopped()));

      if (editor.isExecuting()) {
        this.emitEnableDisableAllControls(false);
      }
    }
  }

  handleWorkspaceExited() {
    if (this.isExecutableInDebuggingMode) {
      this.emitEnableDisableAllControls(false);
    } else {
      this.handleLevelChanged();
      this.execSubscriptions.dispose();
    }
  }

  handleLevelChanged() {
    if (!this.isExecutableInDebuggingMode) {
      if (levelsWorkspaceManager.isActiveLevelDebuggable()) {
        this.emitStatusUpdated(this.lastEventBeforeDisabling);
        this.emitEnableDisableAllControls(true);
      } else {
        if (this.currentStatusEvent.getStatus() !== statusUpdateEventFactory.DISABLED_STATUS) {
          this.lastEventBeforeDisabling = this.currentStatusEvent;
        }
        this.emitStatusUpdated(statusUpdateEventFactory.createDisabled(this.isReplay));
        this.emitEnableDisableAllControls(false);
      }
    }
  }

  handleLevelCodeEditorChanged() {
    const editor = levelsWorkspaceManager.getActiveLevelCodeEditor();

    if (this.isExecutableInDebuggingMode) {
      const enabled = this.debuggingEditorId === editor.getId();
      this.emitEnableDisableAllControls(enabled);
    } else {
      this.execSubscriptions.dispose();
      this.execSubscriptions = new CompositeDisposable();
      this.execSubscriptions.add(editor.onDidStartExecution(() => this.handleExecutableStarted()));
      this.execSubscriptions.add(editor.onDidStopExecution(() => this.handleExecutableStopped()));

      if (editor.isExecuting()) {
        this.emitEnableDisableAllControls(false);
      } else {
        this.emitEnableDisableAllControls(levelsWorkspaceManager.isActiveLevelDebuggable());
      }
    }
  }
}
