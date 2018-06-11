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

    destroy() {
      this.emitter.dispose();
    }

    recordState(state) {
      this.recordedStates.push(state);
    }

    recordEntryPoint(callId) {
      this.entryPoints[callId] = this.recordedStates.length;
    }

    startReplay(callId) {
      this.stateIndex = this.entryPoints[callId];
      return this.recordedStates[this.stateIndex];
    }

    replayStep() {
      this.stateIndex = this.stateIndex + 1;
      return this.recordedStates[this.stateIndex];
    }

    endOfTape() {
      return ((this.stateIndex + 1) == this.recordedStates.length);
    }
}
