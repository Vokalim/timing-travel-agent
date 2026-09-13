import {searchTravel} from './travel-service.js';
import {createTemporalContext,planRepresentativeDateWindows} from './discovery/temporal-context.js';
import {createTripRequest} from './trip-request.js';

// Bounded, provisional search assumptions; never presented as user-provided facts.
export function prepareExploration(input,{now=new Date(),language='zh'}={}) {
 const trip=createTripRequest(input);
 if(!trip.origin?.trim())throw new Error(language==='zh'?'先告诉途米从哪里出发。':'Tell Timing where you are leaving from.');
 const context=createTemporalContext({earliestDeparture:trip.start||null,latestDeparture:trip.end||null,departureWindowText:trip.departureWindowText||''},{now,language});
 const durationProvided=Number.isInteger(trip.nights)&&trip.nights>0;
 const durationRange=durationProvided?null:context.kind==='relative_weekend'?[2,3]:[4,6];
 const nights=durationProvided?trip.nights:durationRange[0]+1;
 const exactDates=Boolean(trip.start&&trip.end);
 const windows=planRepresentativeDateWindows(context,nights,{limit:3});
 const guidance=!exactDates?language==='zh'?'你还没确定具体日期，途米会先比较几个更划算的时间段。':'No exact dates yet. Timing will compare a few exploratory windows.':!durationProvided?language==='zh'?`还没想好玩几天？先按 ${durationRange[0]}–${durationRange[1]} 天帮你找。`:`Unsure how long? Start with ${durationRange[0]}–${durationRange[1]} days.`:trip.flightBudget==null||trip.hotelBudget==null?language==='zh'?'预算未填写，先按性价比排序。':'No budget yet. Ranking by value and convenience.':null;
 return {trip,context,windows,nights,durationRange,durationSource:durationProvided?'user_provided':'system_provisional',dateSource:exactDates?'user_provided':'system_generated_exploration_window',guidance};
}

export async function planTrip(input,mode='demo',options={}){
 const plan=prepareExploration(input,options);
 if(!plan.trip.destination)return {destinationState:'discovery_required',plan};
 if(!plan.windows.length)throw new Error('No exploration windows could be generated for this period.');
 const dates=plan.dateSource==='user_provided'?null:plan.windows.map(w=>w.departure);
 const searchInput={...plan.trip,nights:plan.nights,start:dates?dates[0]:plan.trip.start,end:dates?dates.at(-1):plan.trip.end,candidateDates:dates};
 const result=await searchTravel(searchInput,mode,options);
 return {...result,plan};
}
