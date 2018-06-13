'use babel';

import {CompositeDisposable}     from 'atom';
import installDependencies       from 'atom-package-deps';
import levelsWorkspaceManager    from './common/levels-workspace-manager';
import IncomingMessageDispatcher from './messaging/incoming-message-dispatcher';
import SocketChannel             from './messaging/socket-channel';
import DebuggerPresenter         from './presenter/debugger-presenter';
import DebuggerView              from './views/debugger-view';

export default {
  //Called when package is initially loaded by atom.
  activate() {
    // Install dependant Packages.
    installDependencies('levels-debugger-ruby');

    // Create Dispatcher for incoming Messages.
    this.incomingMessageDispatcher = new IncomingMessageDispatcher();
    // Create SocketChannel for Communication with Runtime.
    this.socketChannel = new SocketChannel('localhost', 59598, this.incomingMessageDispatcher);
    // Create Presenter for reacting.
    this.debuggerPresenter = new DebuggerPresenter(this.incomingMessageDispatcher, this.socketChannel);

    //Add Commands to packages menu.
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.workspace.addOpener(uri => this.handleOpener(uri)));
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'levels-debugger-ruby:toggle-debugger-view': () => this.toggle(),
      'levels-debugger-ruby:toggle-breakpoint': () => this.debuggerPresenter.toggleBreakpoint(),
      'levels-debugger-ruby:remove-all-breakpoints': () => this.debuggerPresenter.removeAllBreakpoints(),
      'levels-debugger-ruby:enable-disable-all-breakpoints': () => this.debuggerPresenter.enableDisableAllBreakpoints(),
      'levels-debugger-ruby:start-debugging': () => this.debuggerPresenter.startDebugging(),
      'levels-debugger-ruby:stop-debugging': () => this.debuggerPresenter.stopDebugging(),
      'levels-debugger-ruby:step': () => this.debuggerPresenter.step(),
      'levels-debugger-ruby:step-over': () => this.debuggerPresenter.stepOver(),
      'levels-debugger-ruby:run-to-end-of-method': () => this.debuggerPresenter.runToEndOfMethod(),
      'levels-debugger-ruby:run-to-next-breakpoint': () => this.debuggerPresenter.runToNextBreakpoint(),
      'levels-debugger-ruby:stop-replay': () => this.debuggerPresenter.stopReplay()
    }));
  },

  //Called when package is deactivated.
  deactivate() {
    this.subscriptions.dispose();
    this.debuggerView.destroy();
    this.debuggerPresenter.destroy();
    this.socketChannel.destroy();
    this.incomingMessageDispatcher.destroy();
    levelsWorkspaceManager.destroy();
  },

  //Generates a new DebuggerView.
  handleOpener(uri) {
    if (uri === 'atom://levels-debugger-ruby') {
      return new DebuggerView(this.debuggerPresenter);
    }
  },

  //Shows the menu for the Debugger on the right side.
  toggle() {
    atom.workspace.toggle('atom://levels-debugger-ruby');
  },

  //Wird wo aufgerufen??
  consumeLevels({workspace}) {
    levelsWorkspaceManager.attachWorkspace(workspace);
  }
};
