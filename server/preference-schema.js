export const TRAVEL_INTENTS = ['festive','beach','relaxation','hiking','food','culture','nature','snow_winter','shopping','family','romantic'];

const nullable = type => ({type:[type,'null']});

/** Exact schema sent to the Responses API with strict Structured Outputs enabled. */
export const PREFERENCE_OUTPUT_SCHEMA = {
  type:'object',
  properties:{
    origin:{...nullable('string'),description:'Geographic origin explicitly stated by the user.'},
    originEvidence:{...nullable('string'),description:'Exact origin phrase copied from the user text.'},
    destination:{...nullable('string'),description:'Real geographic destination, or null for a theme/concept/unknown place.'},
    destinationEvidence:{...nullable('string'),description:'Exact destination place phrase copied from the user text, or null.'},
    destinationState:{type:'string',enum:['provided','discovery_required']},
    earliestDeparture:{...nullable('string'),description:'Exact ISO 8601 date only when explicitly supplied with a year.'},
    latestDeparture:{...nullable('string'),description:'Exact ISO 8601 date only when explicitly supplied with a year.'},
    departureWindowText:{...nullable('string'),description:'Broad or incomplete date wording such as December or 12月.'},
    durationDays:{type:['integer','null'],minimum:1,maximum:30},
    totalTripBudgetCny:{type:['number','null'],minimum:1,maximum:300000},
    flightBudgetCny:{type:['number','null'],minimum:1,maximum:100000},
    hotelBudgetPerNightCny:{type:['number','null'],minimum:1,maximum:100000},
    minimumHotelRating:{type:['number','null'],minimum:1,maximum:5},
    avoidOvernightFlights:{type:['boolean','null']},
    travelIntents:{type:'array',items:{type:'string',enum:TRAVEL_INTENTS},maxItems:11},
    domesticAllowed:{type:['boolean','null']},
    internationalAllowed:{type:['boolean','null']},
    pace:{type:['string','null'],enum:['relaxed','balanced','active',null]},
    preferences:{type:'array',items:{type:'string',maxLength:120},maxItems:10}
  },
  required:['origin','originEvidence','destination','destinationEvidence','destinationState','earliestDeparture','latestDeparture','departureWindowText','durationDays','totalTripBudgetCny','flightBudgetCny','hotelBudgetPerNightCny','minimumHotelRating','avoidOvernightFlights','travelIntents','domesticAllowed','internationalAllowed','pace','preferences'],
  additionalProperties:false
};

export const PREFERENCE_SCHEMA_NAME = 'travel_scout_trip_preferences';
