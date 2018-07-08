'use babel';

import {EOL, DELIMITER} from './message-utils';

function createMessage(msg) {
  return msg + EOL;
}

export function createStepMessage() {
  return createMessage('STEP');
}
