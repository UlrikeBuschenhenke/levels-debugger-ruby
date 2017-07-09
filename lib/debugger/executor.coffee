{BufferedProcess, Emitter} = require 'atom'
path                       = require 'path'

class Executor
  constructor: ->
    @resetFlags()

  startDebugger: ->
    debuggerPath = path.join __dirname, 'debugger.jar'
    command = 'java'
    args = ['-jar', debuggerPath]
    stdout = (output) => @handleOutput output
    exit = (code) => @handleExit code
    @process = new BufferedProcess {command, args, stdout, exit}
    @emitter = new Emitter
    return

  stopDebugger: ->
    @process.kill()
    @emitStop()
    @emitter.dispose()
    return

  handleExit: (code) ->
    @emitStop()
    @emitter.dispose()
    @resetFlags()
    return

  handleOutput: (output) ->
    if output.indexOf('!!!VIEWCHANNELREADY!!!') > -1
      @viewChannelReady = true

    if output.indexOf('!!!RUNTIMECHANNELREADY!!!') > -1
      @runtimeChannelReady = true

    if @viewChannelReady && @runtimeChannelReady
      @emitReady()
      @resetFlags()

    return

  emitStop: ->
    @emitter.emit 'execution-stopped'
    return

  onStop: (callback) ->
    @emitter.on 'execution-stopped', callback
    return

  emitReady: ->
    @emitter.emit 'debugger-ready'
    return

  onReady: (callback) ->
    @emitter.on 'debugger-ready', callback
    return

  resetFlags: ->
    @runtimeChannelReady = false
    @viewChannelReady = false
    return

module.exports =
class ExecutorProvider
  instance = null

  @getInstance: ->
    instance ?= new Executor