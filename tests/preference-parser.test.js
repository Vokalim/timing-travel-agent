import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoPreferenceParser, PreferenceParser} from '../dist/lib/preference-parser.js';
const parser = new DemoPreferenceParser();
test('example fills known fields and retains overnight constraint for review', async () => {
  const draft = await parser.parse('I want to travel from Shanghai to Tokyo for 5 nights sometime between November 2 and November 15. My round-trip flight budget is ¥2100 and hotel budget is ¥700 per night. I prefer highly rated hotels and want to avoid overnight flights.');
  assert.ok(parser instanceof PreferenceParser);
  assert.equal(draft.fields.origin,'Shanghai');assert.equal(draft.fields.destination,'Tokyo');assert.equal(draft.fields.nights,5);assert.equal(draft.fields.flightBudget,2100);assert.equal(draft.fields.hotelBudget,700);assert.match(draft.fields.notes,/avoid overnight flights/);
  assert.deepEqual(draft.needsConfirmation,['start','end','rating']);
  assert.ok(draft.warnings.some(w=>w.includes('no year')));
  assert.ok(!draft.warnings.some(w=>w.includes('not supported')));
});
test('explicit year and numeric rating populate a complete draft', async () => {
  const draft = await parser.parse('From Shanghai to Tokyo for 5 nights between November 2 and November 15, 2026. Round-trip flight budget ¥2100 and hotel budget ¥700 per night. Minimum guest rating 4.5 out of 5. I prefer comfort.');
  assert.equal(draft.fields.start,'2026-11-02');
  assert.equal(draft.fields.end,'2026-11-15');
  assert.equal(draft.fields.rating,4.5);
  assert.equal(draft.fields.notes,'Prioritize comfort');
  assert.deepEqual(draft.needsConfirmation,[]);
});
test('missing, conflicting and invalid fields are never defaulted', async () => {
  const empty = await parser.parse('Somewhere nice');
  assert.equal(empty.needsConfirmation.length,8);
  const bad = await parser.parse('For 5 nights or 7 nights between February 30 and March 5, 2027. Round-trip flight budget ¥2100 or round-trip flight budget ¥3500. Minimum guest rating 7 out of 5.');
  for(const key of ['start','end','nights','rating','flightBudget']) assert.equal(bad.fields[key],undefined);
});
test('ISO dates parse while non-CNY budgets and negated preferences are not inferred', async () => {
  const draft = await parser.parse('Between 2026-11-02 and 2026-11-15. Round-trip flight budget ¥2100 CAD. Hotel budget ¥700 per night. I do not want nonstop flights.');
  assert.equal(draft.fields.start,'2026-11-02');
  assert.equal(draft.fields.end,'2026-11-15');
  assert.equal(draft.fields.flightBudget,undefined);
  assert.equal(draft.fields.hotelBudget,undefined);
  assert.equal(draft.fields.notes,'');
});
test('supported travel themes are represented without affecting trip fields', async () => {
  const draft = await parser.parse('A Christmas trip with beaches, relaxation, hiking, food, culture and nature.');
  assert.deepEqual(draft.fields.travelIntents,['festive','beach','relaxation','hiking','food','culture','nature']);
});
