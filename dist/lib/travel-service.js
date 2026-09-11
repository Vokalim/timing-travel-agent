import {scout} from './engine.js';
import {createTravelProviders} from './providers/index.js';
import {MockPreferenceInterpreter} from './preferences.js';

/** Orchestration only. No arithmetic, LLM decisions, or automatic fallback here.
 * Any failed live date/provider rejects the whole comparison: no partial or mixed prices.
 */
export async function searchTravel(trip, mode = 'demo', options = {}) {
  const {flights, hotels} = createTravelProviders(mode, options);
  const result = await scout(trip, options.interpreter ?? new MockPreferenceInterpreter(), flights, hotels);
  return {...result, dataSource:mode};
}
