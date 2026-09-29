import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalCoordinates,normalizeTravelPoi,VerificationState} from '../dist/lib/models/canonical-poi.js';
import {localizePoiContent,localizedPoiName,secondaryOfficialName} from '../dist/lib/content-localization.js';
import {TravelResearchService} from '../server/research/travel-research-service.js';
import {TripWorkspaceSession} from '../dist/lib/trip-workspace.js';
import {renderTripSections} from '../dist/trip-view.js';

const source={provider:'Wikivoyage',sourceType:'open_travel_guide',sourceUrl:'https://en.wikivoyage.org/wiki/Dali',retrievedAt:'2026-09-29T00:00:00.000Z',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',attribution:'Wikivoyage contributors',verificationLevel:'open_source'};
const place=(id,name,category='culture',index=0)=>normalizeTravelPoi({
 id,provider:'wikivoyage',providerPlaceId:`Dali#${index}`,canonicalName:name,sourceName:name,displayName:name,names:{zh:null,en:name},description:{zh:null,en:null},destinationId:'dali',destination:'Dali',country:'China',category,
 coordinates:canonicalCoordinates(25.60+index*.01,100.22+index*.01,'WGS84'),source:'wikivoyage',sourceType:'open_travel_guide',sourceUrl:source.sourceUrl,sourceAttribution:{provider:'Wikivoyage',required:true,license:'CC BY-SA 4.0'},provenance:[source],verificationState:VerificationState.OPEN_SOURCE_VERIFIED,planningTags:[category],planningSignals:{destinationRepresentativeness:1-index*.05},dataFetchedAt:source.retrievedAt
});

test('POI localization preserves provider identity while selecting content-locale names',()=>{
 const museum=localizePoiContent(place('museum','Dali Bai Nationality Autonomous Prefecture Museum','museum'),'zh-CN');
 assert.equal(museum.names.zh,'大理白族自治州博物馆');
 assert.equal(museum.names.en,'Dali Bai Nationality Autonomous Prefecture Museum');
 assert.equal(museum.sourceName,'Dali Bai Nationality Autonomous Prefecture Museum');
 assert.equal(localizedPoiName(museum,'zh-CN'),'大理白族自治州博物馆');
 assert.equal(localizedPoiName(museum,'en-US'),'Dali Bai Nationality Autonomous Prefecture Museum');
 assert.equal(secondaryOfficialName(museum,'zh-CN'),'Dali Bai Nationality Autonomous Prefecture Museum');
});

test('brand names remain intact and untranslated English POIs use a safe localized category label',()=>{
 const brand=localizePoiContent(place('cafe','Cafe de Jack','food',2),'zh-CN');
 assert.equal(localizedPoiName(brand,'zh-CN'),'Cafe de Jack');
 assert.equal(brand.localizationState,'brand_preserved');
 const unknown=localizePoiContent(place('unknown','Example Untranslated Heritage Hall','culture',3),'zh-CN');
 assert.equal(unknown.names.zh,null);
 assert.equal(unknown.localizationState,'pending');
 assert.equal(localizedPoiName(unknown,'zh-CN'),'当地文化景点');
 assert.equal(localizedPoiName(unknown,'en-US'),'Example Untranslated Heritage Hall');
 assert.equal(secondaryOfficialName(unknown,'zh-CN'),null);
});

test('travel research localizes English provider results before they reach the itinerary',async()=>{
 const raw=[place('museum','Dali Bai Nationality Autonomous Prefecture Museum','museum'),place('park','Erhai Park','nature',1),place('cafe','Cafe de Jack','food',2)];
 const service=new TravelResearchService({wikivoyageProvider:{research:async()=>({candidatePois:raw,destinationInsights:[],sources:[source]})}});
 const result=await service.research({countryCode:'CN',destinationId:'dali',destinationName:'Dali',countryName:'China',contentLocale:'zh-CN'});
 assert.equal(result.contentLocale,'zh-CN');
 assert.deepEqual(result.candidatePois.map(item=>localizedPoiName(item,'zh-CN')),['大理白族自治州博物馆','洱海公园','Cafe de Jack']);
});

test('Chinese itinerary renders Chinese-first POIs and localized open-source status',()=>{
 const raw=[place('museum','Dali Bai Nationality Autonomous Prefecture Museum','museum'),place('park','Erhai Park','nature',1),place('cafe','Cafe de Jack','food',2)].map(item=>localizePoiContent(item,'zh-CN'));
 const session=new TripWorkspaceSession({trip:{origin:'Shanghai',destination:'Dali',nights:1,notes:'美食和慢旅行'},pace:'balanced'});
 session.applyResearchResult({destination:{id:'dali',name:'Dali'},contentLocale:'zh-CN',candidatePois:raw,destinationInsights:[],sources:[source],researchStatus:VerificationState.OPEN_SOURCE_VERIFIED});
 const zh=renderTripSections(session.experience,'zh','zh-CN');
 assert.match(zh,/大理白族自治州博物馆/);
 assert.match(zh,/洱海公园/);
 assert.match(zh,/Cafe de Jack/);
 assert.match(zh,/公开旅行资料 · 营业时间暂未查询/);
 assert.doesNotMatch(zh,/开放旅行资料 · Wikivoyage/);
 const en=renderTripSections(session.experience,'en','en-US');
 assert.match(en,/Dali Bai Nationality Autonomous Prefecture Museum/);
 assert.match(en,/Erhai Park/);
});

test('browser request keeps UI locale and content locale separate',async()=>{
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(app,/uiLocale='zh-CN',contentLocale='zh-CN'/);
 assert.match(app,/uiLocale,contentLocale,locale:contentLocale/);
 assert.match(app,/state\.contentLocale!==contentLocale/);
});
