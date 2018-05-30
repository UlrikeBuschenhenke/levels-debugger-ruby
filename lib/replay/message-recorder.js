'use-babel';

import PushOntoCallStackMessage from '../messaging/push-onto-call-stack-message';

//Class for recording Messages.
export default class MessageRecorder {

  /*Functions called from outside class*/

    //Create new message recorder.
    constructor () {
        this.nextMessageIndex = 0;
        this.messages = [];
        this.pushMessageIndices = {};
        this.recordingEnabled = true;
    }

    //Adds a message that can later be replayed.
    record(message) {
      if (this.recordingEnabled) {
        this.messages.push(message);
        if (message instanceof PushOntoCallStackMessage) {
          this.pushMessageIndices[message.getId()] = this.messages.size();
        }
      }
    }

    //Forwards the tape to the push message of the requested call.
    forwardToCall(callId) {
      const nextIndex = this.pushMessageIndices[callId];
      if (nextIndex != null) {
        this.nextMessageIndex = nextIndex;
      }
    }

    //Replays the next message from the list of recorded messages.
    playNextMessage() {
      if (this.hasMoreMessages()) {
        const index = this.nextMessageIndex + 1;
        return this.messages[index];
      }
    }

    //Checks if more messages are available.
    hasMoreMessages() {
      const hasMore = this.messages.length > this.nextMessageIndex;
      return hasMore;
    }

  /*Getter*/

    isRecordingEnabled() {
      return this.recordingEnabled;
    }

  /*Setter*/

    setRecordingEnabled(recordingEnabled) {
      this.recordingEnabled = recordingEnabled;
    }
}
