'use babel';

import {DELIMITER} from './message-utils';
import Position    from '../common/position';

export default class UpdatePositionMessage {
  constructor(message) {
    var msg = message.split(DELIMITER);
    this.position = new Position(parseInt(msg[0]), parseInt(msg[1]));
  }

  getPosition() {
    this.position;
  }
}
