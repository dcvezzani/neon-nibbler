// Fixed-timestep driver. Time is accumulated in integer ticks of 1/60000 s
// so frame pacing never changes how many simulation steps run overall.
import { STEP_HZ } from './constants.js';

export const MAX_STEPS_PER_FRAME = 5;

export function createStepper(stepFn, hz = STEP_HZ) {
  const perStep = 1000; // accumulator units per step (dtMs * hz units arrive per ms)
  let acc = 0;
  return {
    /** Feed real elapsed milliseconds; runs whole steps; returns steps run. */
    advance(dtMs) {
      acc += Math.round(dtMs * hz);
      let n = 0;
      while (acc >= perStep && n < MAX_STEPS_PER_FRAME) { stepFn(); acc -= perStep; n++; }
      if (n === MAX_STEPS_PER_FRAME && acc >= perStep) acc = 0; // drop backlog after stalls
      return n;
    },
    reset() { acc = 0; },
  };
}
