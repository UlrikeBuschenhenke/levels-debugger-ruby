'use babel';

import {CompositeDisposable, Emitter} from 'atom';
import levelsWorkspaceManager         from '../common/levels-workspace-manager';
import {toPoint}                      from '../common/position-utils';
import * as statusUpdateEventFactory  from '../common/status-update-event-factory';
import Debugger                       from '../debugger/debugger';
import * as outgoingMessageFactory    from '../messaging/outgoing-message-factory';
import UpdatePositionMessage          from '../messaging/update-position-message';
import UpdateTableMessage             from '../messaging/update-table-message';
import PushOntoCallStackMessage       from '../messaging/push-onto-call-stack-message';
import CheckValueMessage              from '../messaging/check-value-message';

//Class for managing the elements of the package.
export default class DebuggerPresenter {

/*Functions called from outside class*/

  //Create new DebuggerPresenter.
  constructor(incomingMessageDispatcher, socketChannel) {
    this.incomingMessageDispatcher = incomingMessageDispatcher;
    this.socketChannel = socketChannel;
    this.debugger = new Debugger();
    this.emitter = new Emitter();

    this.positionMarker = null;
    this.isReplay = false;
    this.isExecutableInDebuggingMode = false;
    this.isAutoSteppingEnabled = true;
    this.areAllControlsDisabled = false;

    this.showPositionMarker = true;
    this.callId = 0;

    this.currentStatusEvent = statusUpdateEventFactory.createStopped(false);
    this.lastEventBeforeDisabling = this.currentStatusEvent;
    this.lastEventBeforeReplay = null;

    this.execSubscriptions = null;

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(this.debugger.onReady(() => this.startExecutableAndConnect()));
    this.subscriptions.add(this.debugger.onStop(() => this.handleStop()));
    this.subscriptions.add(this.debugger.onPositionUpdated(position => this.emitPositionUpdated(position)));
    this.subscriptions.add(this.debugger.onAutoSteppingEnabled(() => this.emitAutoSteppingEnabled()));
    this.subscriptions.add(this.debugger.onAutoSteppingDisabled(() => this.emitAutoSteppingDisabled()));
    this.subscriptions.add(this.debugger.onSendStepSignal(() => this.sendStepSignal()));
    this.subscriptions.add(this.debugger.onUpdateTable(() => this.emitVariableTableUpdated()));
    this.subscriptions.add(this.debugger.onReplayStarted(() => this.emitReplayStarted()));
    this.subscriptions.add(this.debugger.onEndOfReplayTape(() => this.handleEndOfReplayTape()));
    this.subscriptions.add(this.debugger.onEnablePositionMarker(() => this.showPositionMarker = true));
    this.subscriptions.add(this.debugger.onDisablePositionMarker(() => this.showPositionMarker = false));
    this.subscriptions.add(levelsWorkspaceManager.onWorkspaceAttached(workspace => this.setLevelsWorkspace(workspace)));
    this.subscriptions.add(this.socketChannel.onError(() => this.handleChannelError()));
    this.subscriptions.add(this.incomingMessageDispatcher.onUpdatePosition(message => this.updatePosition(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onUpdateTable(message => this.updateTable(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onPushOntoCallstack(message => this.pushOntoCallstack(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onPopFromCallstack(message => this.popFromCallstack(message)));
    this.subscriptions.add(this.incomingMessageDispatcher.onCheckValue(message => this.checkVariableValue(message)));
  }

  //Destroys the DebuggerPresenter.
  destroy() {
    this.disconnectAndCleanup();
    this.debugger.destroy();
    this.subscriptions.dispose();
    if (this.execSubscriptions) {
      this.execSubscriptions.dispose();
    }
  }

  //Starts the debugger.
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

  //Stops the debugger.
  stopDebugging() {
    if (!this.areAllControlsDisabled && this.isExecutableInDebuggingMode) {
      this.disconnectAndCleanup();
    }
  }

  //Called when Step button is clicked.
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

  //Called when StepOver button is clicked.
  stepOver() {
    if (this.areSteppingCommandsEnabled()) {
      this.emitStatusUpdated(statusUpdateEventFactory.createRunning(this.isReplay));
      this.debugger.enableAutoStepping();
      if (this.isReplay) {
        this.debugger.replayStep();
      } else {
        this.debugger.stepOver();
        this.sendStepSignal();
      }
    }
  }

  //Sets a new breakpoint or removes an existing breakpoint.
  toggleBreakpoint() {
    if (!this.areAllControlsDisabled) {
      for (const point of levelsWorkspaceManager.getActiveTextEditorCursorPositions()) {
        this.debugger.toggleBreakpoint(point);
      }
    }
  }

  //Removes all existing breakpoints
  removeAllBreakpoints() {
    if (!this.areAllControlsDisabled) {
      this.debugger.removeAllBreakpoints();
    }
  }

  //Enables or Disables all existing breakpoints.
  enableDisableAllBreakpoints() {
    if (!this.areAllControlsDisabled) {
      this.debugger.enableDisableAllBreakpoints();
      this.emitEnableDisableAllBreakpoints();
    }
  }

  //Called when RunToNextBreakpoint button is clicked.
  runToNextBreakpoint() {
    if (this.areSteppingCommandsEnabled()) {
      this.emitStatusUpdated(statusUpdateEventFactory.createRunning(this.isReplay));
      this.debugger.enableAutoStepping();
      if (this.isReplay) {
        this.debugger.replayRunToNextBreakpoint();
      } else {
        this.sendStepSignal();
      }
    }
  }

  //Called when RunToEndOfMethod button is clicked.
  runToEndOfMethod() {
    if (this.areSteppingCommandsEnabled() && !this.debugger.isCallStackEmpty()) {
      this.emitStatusUpdated(statusUpdateEventFactory.createRunning(this.isReplay));
      this.debugger.enableAutoStepping();
      if (this.isReplay) {
        this.debugger.replayStep();
      } else {
        this.debugger.runToEndOfMethod();
        this.sendStepSignal();
      }
    }
  }

  //Starts the replay of a certain call.
  startReplay(element) {
    if (!this.areAllControlsDisabled && this.isExecutableInDebuggingMode && (this.currentStatusEvent.getStatus() !== statusUpdateEventFactory.RUNNING_STATUS)) {

      if (!this.isReplay && (this.currentStatusEvent.getStatus() !== statusUpdateEventFactory.END_OF_TAPE_STATUS)) {
        this.lastEventBeforeReplay = this.currentStatusEvent;
      }
      this.isReplay = true;
      this.debugger.startReplay(element.dataset.callId);
    }
  }

  //Stops the active replay.
  stopReplay() {
    if (!this.areAllControlsDisabled && this.isReplay) {
      this.debugger.stopReplay();
      this.isReplay = false;
      this.emitReplayStopped();
      this.emitStatusUpdated(this.lastEventBeforeReplay);
    }
  }

  //Initializes the view.
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

  flipAndSortVariableTable() {
    if (!this.areAllControlsDisabled && this.isExecutableInDebuggingMode) {
      this.debugger.flipAndSortVariableTable();
      this.emitVariableTableUpdated();
    }
  }

/*Functions only called from within class*/

  //Called when an UpdatePositionMessage arrives.
  updatePosition(message) {
    const msg = new UpdatePositionMessage(message);
    this.debugger.updatePosition(msg);
  }

  //Called when an UpdateTableMessage arrives.
  updateTable(message) {
    const msg = new UpdateTableMessage(message);
    this.debugger.updateVariableTable(msg);
  }

  //Called when a PushOntoCallStackMessage arrives.
  pushOntoCallstack(message) {
    const msg = new PushOntoCallStackMessage(message, this.callId);
    this.debugger.pushOntoCallStack(msg);
    this.callId = this.callId + 1;
  }

  //Called when a PopFromCallStackMessage arrives.
  popFromCallstack(message) {
    this.debugger.popFromCallStack();
  }

  //Called when a CheckValueMessage arrives.
  checkVariableValue(message) {
    const msg = new CheckValueMessage(message);
    this.debugger.checkVariableValue(msg);
  }

  //Disconnects socket channel and stops debugger and executable.
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

  startExecutableAndConnect() {
    this.socketChannel.connect();
    this.isExecutableInDebuggingMode = true;
    this.debuggingEditorId = levelsWorkspaceManager.getActiveLevelCodeEditor().getId();
    this.startExecutable();
    this.emitRunning();
    this.emitAutoSteppingDisabled();
  }

  //Send StepMessage via socket channel to runtime.
  sendStepSignal() {
    this.socketChannel.sendMessage(outgoingMessageFactory.createStepMessage());
  }

  areSteppingCommandsEnabled() {
    return !this.areAllControlsDisabled && this.isExecutableInDebuggingMode && !this.isAutoSteppingEnabled;
  }

  startExecutable() {
    levelsWorkspaceManager.getActiveLevelCodeEditor().startExecution({runExecArgs: ['-d']});
  }

  stopExecutable() {
    levelsWorkspaceManager.getActiveLevelCodeEditor().stopExecution();
  }

/*Getter*/

  getCallStack() {
    return this.debugger.getCallStack();
  }

  getVariableTable() {
    return this.debugger.getVariableTable();
  }

  getAreBreakpointsEnabled() {
    return this.debugger.getAreBreakpointsEnabled()
  }

/*EventSubscription*/

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

/*EventEmission*/

  emitRunning() {
    this.emitter.emit('running');
  }

  emitStopped() {
    this.emitter.emit('stopped');
  }

  emitPositionUpdated(currentPosition) {
    const point = toPoint(currentPosition);

    this.emitVariableTableUpdated()
    this.emitCallStackUpdated();

    this.debugger.restoreHiddenBreakpoint();
    this.debugger.hideBreakpoint(currentPosition);

    if (this.showPositionMarker) {
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
    if (this.showPositionMarker) {
      this.emitter.emit('call-stack-updated');
    }
  }

  emitVariableTableUpdated() {
    if (this.showPositionMarker) {
      this.emitter.emit('variable-table-updated');
    }
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
    this.emitter.emit('enable-disable-all-breakpoints', this.getAreBreakpointsEnabled());
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

/*Handler*/

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

  handleStop() {
    if (this.isExecutableInDebuggingMode) {
      this.disconnectAndCleanup();
    }

    this.isReplay = false;
    this.isAutoSteppingEnabled = true;
    this.showPositionMarker = true;
    this.callId = 0;
    this.debugger.resetSortModeVariableTable();
    this.emitStopped();
    this.emitAutoSteppingEnabled();

    if (this.positionMarker) {
      this.positionMarker.destroy();
    }
    this.debugger.restoreHiddenBreakpoint();

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
