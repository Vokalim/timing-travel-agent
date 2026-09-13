import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DISPLAY_LABELS,displayLabel,displayIntentReason,displayTravelPeriod,presentDiscoveryCandidate,displayTransportStatus} from '../dist/lib/display-localization.js';
import {createTemporalContext} from '../dist/lib/discovery/temporal-context.js';
import {buildTripExperience} from '../dist/lib/trip-experience.js';
import {renderTripHero,renderTripSections} from '../dist/trip-view.js';
import {discoverDestinations} from '../dist/lib/discovery/destination-discovery.js';

const candidate={city:'Osaka',countryOrRegion:'Japan',iataOrMetroCode:'OSA',themes:['beach','food','self_drive'],verification:{status:'not_checked',source:'demo'},transport:{}};
const data={context:createTemporalContext({departureWindowText:'November'},{now:new Date('2026-09-13T00:00:00Z')}),displayPreferences:{travelIntents:['food','beach']}};

test('canonical taxonomy has localized labels and safe fallback',()=>{
 assert.equal(displayLabel('food','zh'),'美食');assert.equal(displayLabel('food','en'),'Food');
 assert.equal(displayLabel('beach','zh'),'海边');assert.equal(displayLabel('self_drive','zh'),'自驾');
 assert.equal(displayLabel('self_drive','en'),'Self-drive');
 assert.equal(displayLabel('missing_internal_key','zh'),'旅行偏好');
 assert.equal(displayLabel('missing_internal_key','en'),'Travel preference');
 assert.equal(displayIntentReason('food','zh'),'适合边吃边逛');
 assert.doesNotMatch(displayIntentReason('food','zh'),/food/);
});

test('switching language re-presents the same canonical discovery candidate',()=>{
 const before=structuredClone(candidate),zh=presentDiscoveryCandidate(candidate,data,'zh'),en=presentDiscoveryCandidate(candidate,data,'en');
 assert.deepEqual(candidate,before);assert.equal(candidate.city,'Osaka');assert.equal(candidate.iataOrMetroCode,'OSA');
 assert.equal(zh.city,'大阪');assert.equal(zh.country,'日本');assert.equal(en.city,'Osaka');assert.equal(en.country,'Japan');
 assert.deepEqual(zh.tags,['海边','美食','11月']);assert.deepEqual(en.tags,['Beach','Food','November']);
 assert.match(zh.statement,/边吃边逛/);assert.match(en.statement,/food/i);
 assert.equal(zh.transportStatus,'航班待验证');assert.equal(en.transportStatus,'Flight pending verification');
 assert.doesNotMatch(JSON.stringify(zh),/\b(food|beach|self_drive|not_checked|broad_month)\b/);
});

test('temporal and verified transport states localize without changing source values',()=>{
 assert.equal(displayTravelPeriod(createTemporalContext({departureWindowText:'中秋节'}),'zh'),'中秋节');
 assert.equal(displayTravelPeriod(createTemporalContext({departureWindowText:'中秋节'}),'en'),'Mid-Autumn Festival');
 const verified={verification:{status:'verified',source:'demo',quote:{price:2751,stops:0}},transport:{}};
 assert.match(displayTransportStatus(verified,'zh'),/演示航班参考/);assert.doesNotMatch(displayTransportStatus(verified,'zh'),/Demo/);
 assert.match(displayTransportStatus(verified,'en'),/Demo flight reference/);
});

test('discovery-generated reasons never interpolate canonical intent or season keys',async()=>{
 const result=await discoverDestinations({origin:'Shanghai',destination:null,departureWindowText:'November',durationDays:5,travelIntents:['food']},{language:'zh',now:new Date('2026-09-13T00:00:00Z'),discoveryService:{discover:async()=>({source:'general_prior_fallback',candidates:[{city:'Osaka',countryOrRegion:'Japan',iataOrMetroCode:'OSA',themes:['food','culture']}]})},flightProvider:{search:async()=>[]}});
 assert.equal(result.candidates[0].reasons[0],'适合边吃边逛');
 assert.doesNotMatch(result.candidates[0].reasons.join(' '),/\b(food|culture|autumn|not_checked)\b/);
 assert.deepEqual(result.displayPreferences.travelIntents,['food']);
});

test('representative Chinese discovery and trip display contain no raw taxonomy keys',()=>{
 const zh=presentDiscoveryCandidate(candidate,data,'zh');
 const experience=buildTripExperience({trip:{origin:'Shanghai',destination:'Osaka',nights:5,notes:'最好直飞，住市中心，节奏慢一点'},flightVerification:{status:'not_checked',source:'demo'}});
 const visible=[zh.city,zh.country,zh.statement,...zh.tags,zh.transportStatus,renderTripHero(experience,'zh'),renderTripSections(experience,'zh')].join(' ').replace(/<[^>]*>/g,' ');
 for(const key of Object.keys(DISPLAY_LABELS.zh).filter(key=>/^[a-z][a-zA-Z_]+$/.test(key)&&key!=='live'))assert.doesNotMatch(visible,new RegExp(`\\b${key}\\b`),key);
});

test('language toggle re-renders discovery and trip from canonical state',async()=>{
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(app,/if\(result\)\{[\s\S]*?render\(\);if\(tripWasOpen\)output\.querySelector\('#trip-detail'\)\.hidden=false;\}else if\(independentTrip\)renderStandaloneTrip\(independentTrip\);else if\(discoveryResult\)/);
 assert.match(app,/presentDiscoveryCandidate\(best,data,language\)/);
 assert.match(app,/displayLabel\(d,language\)/);
});
