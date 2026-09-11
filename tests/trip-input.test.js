import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setupTripInput} from '../dist/trip-input.js';
import {FallbackPreferenceParser,LLMPreferenceParser} from '../dist/lib/llm-preference-parser.js';

class Element {
  constructor({name='',value=''}={}) { this.name=name;this.value=value;this.hidden=true;this.disabled=false;this.children=[];this.dataset={};this.listeners={};this.classList={toggle(){}}; }
  addEventListener(type,listener) { this.listeners[type]=listener; }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children=[];this.textContent=''; }
  setAttribute() {}
  querySelector(selector) { return this.children.find(child=>`[data-trip-field="${child.dataset.tripField}"]`===selector); }
  async click() { await this.listeners.click?.({target:this}); }
}

test('real index Explore button uses the app entry and successful preference API result instead of fallback',async()=>{
  const [html,app]=await Promise.all([readFile(new URL('../dist/index.html',import.meta.url),'utf8'),readFile(new URL('../dist/app.js',import.meta.url),'utf8')]);
  const exploreTags=html.match(/<button\b[^>]*\bid="interpret-trip"[^>]*>/g) || [];
  assert.equal(exploreTags.length,1);
  assert.match(exploreTags[0],/\btype="button"/);
  assert.match(html,/<script\b[^>]*\btype="module"[^>]*\bsrc="\/app\.js"/);
  assert.match(app,/setupTripInput\([\s\S]*,preferenceParser\)/);
  const fields=Object.fromEntries(['origin','destination','start','end','nights','flightBudget','hotelBudget','rating','notes'].map(name=>[name,new Element({name})]));
  const form=new Element();form.elements={namedItem:name=>fields[name]};
  const input=new Element({value:'From Shanghai to a beach for 5 days.'});
  const button=new Element(),review=new Element(),status=new Element();
  const elements={'#trip-description':input,'#interpret-trip':button,'#trip-review':review,'#agent-status':status};
  const previousDocument=globalThis.document;
  globalThis.document={documentElement:{lang:'en'},querySelector:selector=>elements[selector],createElement:()=>new Element(),addEventListener(){}};
  let request,fallbackCalled=false,receivedDraft;
  const interpretation={origin:'Shanghai',destination:null,destinationState:'discovery_required',earliestDeparture:null,latestDeparture:null,departureWindowText:null,durationDays:5,flightBudgetCny:null,hotelBudgetPerNightCny:null,minimumHotelRating:null,avoidOvernightFlights:null,travelIntents:['beach'],domesticAllowed:null,internationalAllowed:null,pace:null,preferences:[]};
  const nativeLikeFetch=async function(url,options){assert.equal(this,globalThis);request={url,options};return {ok:true,json:async()=>({interpretation,needsConfirmation:['destination','earliestDeparture','latestDeparture','flightBudgetCny','hotelBudgetPerNightCny','minimumHotelRating'],warnings:[],model:'test-model'})};};
  const primary=new LLMPreferenceParser({fetchImpl:nativeLikeFetch});
  const parser=new FallbackPreferenceParser(primary,{parse:async()=>{fallbackCalled=true;throw new Error('fallback must not run');}});
  try {
    setupTripInput(form,draft=>{receivedDraft=draft;},parser);
    await button.click();
  } finally { globalThis.document=previousDocument; }
  assert.equal(request.url,'/api/travel/preferences/parse');
  assert.equal(request.options.method,'POST');
  assert.deepEqual(JSON.parse(request.options.body),{text:'From Shanghai to a beach for 5 days.'});
  assert.equal(fallbackCalled,false);
  assert.equal(receivedDraft.parserStatus,'ai');
  assert.equal(receivedDraft.source,'openai');
  assert.equal(receivedDraft.fields.origin,'Shanghai');
  assert.equal(receivedDraft.fields.destination,undefined);
  assert.deepEqual(receivedDraft.fields.travelIntents,['beach']);
  assert.doesNotMatch(review.children[0].textContent,/fallback/i);
});
