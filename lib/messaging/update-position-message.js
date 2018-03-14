'use babel';

import {DELIMITER} from './message-utils';
import Position    from '../common/position';

export default class UpdatePositionMessage {
  constructor(message) {
    var msg = message.split(DELIMETER);
    this.position = new Position(parseInt(msg[1]), parseInt(msg[2]));
  }

  getPosition() {
    this.position;
  }
}
