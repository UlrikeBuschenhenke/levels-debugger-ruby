'use babel';

import Breakpoint             from './breakpoint';
import levelsWorkspaceManager from './levels-workspace-manager';
import {fromPoint, toPoint}   from './position-utils';

export default class BreakpointManager {
  constructor() {
    this.breakpoints = [];
    this.arebreakpointsEnabled = true;
    this.hiddenBreakpointPosition = null;
  }

  getAreBreakpointsEnabled() {
    return this.arebreakpointsEnabled;
  }

  getBreakpoints() {
    return this.breakpoints;
  }

  removeAll() {
    for (const bp of this.breakpoints) {
      bp.destroyMarker();
    }

    this.breakpoints = [];
  }

  flip() {
    this.arebreakpointsEnabled = !this.arebreakpointsEnabled;
    for (const bp of this.breakpoints) {
      if (bp.hasMarker()) {
        bp.destroyMarker();
        bp.setMarker(levelsWorkspaceManager.addBreakpointMarker(toPoint(bp.getPosition()), this.arebreakpointsEnabled));
      }
    }
  }

  toggle(point) {
    const breakPointPosition = fromPoint(point);
    const existingBreakpoint = this.getBreakpoint(breakPointPosition);

    if (existingBreakpoint) {
      this.breakpoints = this.breakpoints.filter(bp => bp !== existingBreakpoint);
      existingBreakpoint.destroyMarker();
      return false;
    } else {
      const marker = levelsWorkspaceManager.addBreakpointMarker(point, this.arebreakpointsEnabled);
      this.breakpoints.push(new Breakpoint(breakPointPosition, marker));
      return true;
    }
  }

  getBreakpoint(position) {
    for (const bp of this.breakpoints) {
      if (bp.getPosition().isOnSameLine(position)) {
        return bp;
      }
    }
  }

  hideBreakpoint(position) {
    if (!this.hiddenBreakpointPosition || !position.isOnSameLine(this.hiddenBreakpointPosition)) {
      const breakpoint = this.getBreakpoint(position);
      if (breakpoint) {
        breakpoint.destroyMarker();
        this.hiddenBreakpointPosition = breakpoint.getPosition();
      }
    }
  }

  restoreHiddenBreakpoint() {
    if (this.hiddenBreakpointPosition) {
      const existingBreakpoint = this.getBreakpoint(this.hiddenBreakpointPosition);
      if (existingBreakpoint) {
        const marker = levelsWorkspaceManager.addBreakpointMarker(toPoint(this.hiddenBreakpointPosition), this.arebreakpointsEnabled);
        existingBreakpoint.setMarker(marker);
      }
    }

    this.hiddenBreakpointPosition = null;
  }

  isBreakpoint(position) {
    if (this.arebreakpointsEnabled) {
      const length = this.breakpoints.length;
      for (var i = 0; i < length; i++) {
        if (this.breakpoints[i].getPosition().getLine() == position.getLine()) {
          return true;
        }
      }
    }
    return false;
  }
}
