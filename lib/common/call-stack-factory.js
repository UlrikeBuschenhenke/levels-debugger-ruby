'use babel';

import CallStackEntry             from './call-stack-entry';
import {DELIMITER, ASSIGN_SYMBOL} from '../messaging/message-utils';

export default function callStackEntryFromString(string) {
  if (string) {
    const entry = new CallStackEntry(string.getMethodName() + string.getParamString(), string.getMethodName(), string.getParams(), string.getDefiningClassId(), string.getDefiningInstanceId(), string.getCallId());
    return entry;
  }
}
