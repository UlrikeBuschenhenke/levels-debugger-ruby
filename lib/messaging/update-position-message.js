'use babel';

import {DELIMITER} from './message-utils';
import Position    from '../common/position';

//Class for UpdatePositionMessage.
export default class UpdatePositionMessage {

/*Functions called from outside class*/

  //Create new UpdatePositionMessage.
  constructor(message) {
    var msg = message.split(DELIMITER);
    this.position = new Position(parseInt(msg[0]), parseInt(msg[1]));
  }

/*Getter*/

  getPosition() {
    this.position;
  }
}
