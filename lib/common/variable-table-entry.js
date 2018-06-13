'use babel';

//Class representing an entry in the variable table.
export default class VariableTableEntry {

/*Functions called from outside class*/

  //Create new VariableTableEntry.
  constructor(name, value, address) {
    this.name = name;
    this.value = value;
    this.address = address;
    this.changed = false;
    this.changedExpiresAt = 0;
  }

  //Test wether it must be noted that the variable has changed. 
  isChangedExpired() {
    return this.changedExpiresAt < Date.now();
  }

  //Test for equality.
  equals(other) {
    if (!other) {
      return false;
    }
    if (other.getName() !== this.name) {
      return false;
    }
    if (other.getValue() !== this.value) {
      return false;
    }
    if (other.getAddress() !== this.address) {
      return false;
    }
    return true;
  }

/*Getter*/

  getName() {
    return this.name;
  }

  getValue() {
    return this.value;
  }

  getAddress() {
    return this.address;
  }

  isChanged() {
    return this.changed && !this.isChangedExpired();
  }

  getChangedExpiresAt() {
    return this.changedExpiresAt;
  }

/*Setter*/

  setValue(value) {
    this.value = value;
  }

  setChanged(changed) {
    this.changed = changed;
    if (this.changed) {
      this.changedExpiresAt = Date.now() + 20;
    }
  }

  setChangedExpiresAt(changedExpiresAt) {
    this.changedExpiresAt = changedExpiresAt;
  }
}
