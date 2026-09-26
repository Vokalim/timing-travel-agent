import {DESTINATION_UNIVERSE,getDestination} from './destination-universe.js';

const escape=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const compact=value=>String(value||'').normalize('NFKC').toLowerCase();
const occurrences=(text,name)=>{const matches=[];for(const match of text.matchAll(new RegExp(escape(name),'giu')))matches.push({start:match.index,end:match.index+match[0].length,text:match[0]});return matches;};
const negative=before=>/(?:不要|不想|不去|排除|避开|避開|exclude|avoid|not)\s*(?:去|到|visit|travel to)?\s*$/iu.test(before.slice(-24));
const destinationCue=(before,after)=>/(?:去|到|前往|飞往|飛往|想去|目的地(?:是|为|為)?|to|visit|travel to)\s*$/iu.test(before.slice(-28))||/^\s*(?:玩|旅行|旅游|旅遊|度假|跨年|过圣诞|過聖誕|\d+\s*(?:天|晚)|for\s+\d+\s*(?:days?|nights?))/iu.test(after);
const originCue=(before,after)=>/(?:从|從|自|from)\s*$/iu.test(before.slice(-16))&&/^\s*(?:出发|出發|depart|to\b)/iu.test(after)||/^\s*(?:出发|出發|启程|啟程|departing|departure)/iu.test(after);

/** Finds a real destination explicitly named in the user's text. Themes are not entities. */
export function explicitDestinationFromText(input,{origin=null}={}){
 const text=compact(input),originEntity=getDestination(origin),candidates=[];
 for(const entity of DESTINATION_UNIVERSE){for(const name of new Set([entity.canonicalName,entity.names.zh]))for(const match of occurrences(text,compact(name))){const before=text.slice(0,match.start),after=text.slice(match.end);if(negative(before)||originCue(before,after))continue;const score=destinationCue(before,after)?3:1;candidates.push({entity,score,start:match.start});}}
 const withoutOrigin=candidates.filter(item=>item.entity.id!==originEntity?.id);
 const pool=withoutOrigin.length?withoutOrigin:candidates.filter(item=>item.score>=3);
 if(!pool.length)return null;
 pool.sort((a,b)=>b.score-a.score||a.start-b.start||a.entity.id.localeCompare(b.entity.id));
 if(pool[0].score<3)return null;
 return pool[0].entity;
}

export function normalizeExplicitDestination(input,options){return explicitDestinationFromText(input,options)?.canonicalName||null;}
