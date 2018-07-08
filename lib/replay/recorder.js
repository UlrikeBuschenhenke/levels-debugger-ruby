'use babel';


//Class for managing the replay of a call.
export default class Recorder {

/*Functions called from outside class*/

    //Create new recorder.
    constructor () {
      this.recordedStates = [];
      this.entryPoints = {};
      this.stateIndex = 0;
    }

    //Destroys the recorder.
    destroy() {
      this.emitter.dispose();
    }

    //Records a DebuggerState.
    recordState(state) {
      this.recordedStates.push(state);
    }

    //Records an index of the recorded states as entrypoint for a call.
    recordEntryPoint(callId) {
      this.entryPoints[callId] = this.recordedStates.length;
    }

    //Starts the replay of a certain call.
    startReplay(callId) {
      this.stateIndex = this.entryPoints[callId];
      return this.recordedStates[this.stateIndex];
    }

    //Called if a step in a replay is made.
    replayStep() {
      this.stateIndex = this.stateIndex + 1;
      return this.recordedStates[this.stateIndex];
    }

    //Test if there are no more recorded states.
    endOfTape() {
      return ((this.stateIndex + 1) == this.recordedStates.length);
    }
}
