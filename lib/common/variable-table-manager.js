'use babel';

import VariableTableEntry         from './variable-table-entry';
import {DELIMITER, ASSIGN_SYMBOL} from '../messaging/message-utils';

class VariableTableManager {
  constructor() {
    this.resetSortMode();
  }

  resetSortMode() {
    this.sortAscending = true;
  }

  flipSortMode() {
    this.sortAscending = !this.sortAscending;
  }

  //Creates a VariableTableEntry from an UpdateTableMessage.
  variableTableEntryFromString(string) {
    if (string) {
      const entry = new VariableTableEntry(string.getVariableName(), string.getVariableValue(), string.getVariableAddress());
      return entry;
    }
  }

  markChangedEntries(oldTable, newTable) {
    for (const newEntry of newTable) {
      let hasChanged = true;

      for (const oldEntry of oldTable) {
        if (oldEntry.equals(newEntry)) {
          hasChanged = false;
          if (oldEntry.isChanged()) {
            newEntry.setChanged(true);
            newEntry.setChangedExpiresAt(oldEntry.getChangedExpiresAt());
          }
          break;
        }
      }

      if (hasChanged) {
        newEntry.setChanged(true);
      }
    }
  }

  sort(table) {
    if (table) {
      if (this.sortAscending) {
        table.sort((x, y) => x.getName() >= y.getName() ? 1 : -1);
      } else {
        table.sort((x, y) => x.getName() <= y.getName() ? 1 : -1);
      }
    }
  }
}

export default new VariableTableManager();
