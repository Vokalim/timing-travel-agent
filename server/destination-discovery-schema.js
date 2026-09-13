import {TRAVEL_INTENTS} from './preference-schema.js';

const textArray={type:'array',items:{type:'string',maxLength:160},maxItems:4};

export const DESTINATION_DISCOVERY_SCHEMA={
  type:'object',
  properties:{
    candidates:{type:'array',minItems:5,maxItems:20,items:{
      type:'object',
      properties:{
        city:{type:'string',maxLength:80},
        countryOrRegion:{type:'string',maxLength:80},
        iataOrMetroCode:{type:['string','null']},
        themes:{type:'array',items:{type:'string',enum:TRAVEL_INTENTS},maxItems:6},
        seasonalReasons:textArray,
        generalReasons:textArray,
        estimatedFitSignals:textArray,
        sourceType:{type:'string',enum:['llm_suggestion']},
        confidence:{type:'string',enum:['high','medium','low']}
      },
      required:['city','countryOrRegion','iataOrMetroCode','themes','seasonalReasons','generalReasons','estimatedFitSignals','sourceType','confidence'],
      additionalProperties:false
    }}
  },
  required:['candidates'],additionalProperties:false
};
export const DESTINATION_DISCOVERY_SCHEMA_NAME='timing_destination_discovery';
