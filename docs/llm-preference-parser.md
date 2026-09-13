# LLM preference parsing

The browser `LLMPreferenceParser` implements the existing `PreferenceParser.parse(text)` interface and calls `POST /api/travel/preferences/parse`. The server implementation calls `POST https://api.openai.com/v1/responses` with `OPENAI_API_KEY`, the configured model, and strict Structured Outputs. The browser never receives the key.

The default model is `gpt-4o-mini`; set `OPENAI_PREFERENCE_MODEL` to another Structured Outputs-compatible model when needed. The request sets `store: false`. Copy `.env.example` to `.env`, set `OPENAI_API_KEY`, and restart `npm start`.

## Exact structured output schema

Every property is required by Structured Outputs; unknown values use `null` or an empty array.

```json
{
  "type": "object",
  "properties": {
    "origin": { "type": ["string", "null"] },
    "originEvidence": { "type": ["string", "null"] },
    "destination": { "type": ["string", "null"] },
    "destinationEvidence": { "type": ["string", "null"] },
    "destinationState": { "type": "string", "enum": ["provided", "discovery_required"] },
    "earliestDeparture": { "type": ["string", "null"] },
    "latestDeparture": { "type": ["string", "null"] },
    "departureWindowText": { "type": ["string", "null"] },
    "durationDays": { "type": ["integer", "null"], "minimum": 1, "maximum": 30 },
    "totalTripBudgetCny": { "type": ["number", "null"], "minimum": 1, "maximum": 300000 },
    "flightBudgetCny": { "type": ["number", "null"], "minimum": 1, "maximum": 100000 },
    "hotelBudgetPerNightCny": { "type": ["number", "null"], "minimum": 1, "maximum": 100000 },
    "minimumHotelRating": { "type": ["number", "null"], "minimum": 1, "maximum": 5 },
    "avoidOvernightFlights": { "type": ["boolean", "null"] },
    "travelIntents": { "type": "array", "items": { "type": "string", "enum": ["festive", "beach", "relaxation", "hiking", "food", "culture", "nature", "snow_winter", "shopping", "family", "romantic"] }, "maxItems": 11 },
    "domesticAllowed": { "type": ["boolean", "null"] },
    "internationalAllowed": { "type": ["boolean", "null"] },
    "pace": { "type": ["string", "null"], "enum": ["relaxed", "balanced", "active", null] },
    "preferences": { "type": "array", "items": { "type": "string", "maxLength": 120 }, "maxItems": 10 }
  },
  "required": ["origin", "originEvidence", "destination", "destinationEvidence", "destinationState", "earliestDeparture", "latestDeparture", "departureWindowText", "durationDays", "totalTripBudgetCny", "flightBudgetCny", "hotelBudgetPerNightCny", "minimumHotelRating", "avoidOvernightFlights", "travelIntents", "domesticAllowed", "internationalAllowed", "pace", "preferences"],
  "additionalProperties": false
}
```

The runtime schema in `server/preference-schema.js` also supplies field descriptions to the model.

## Grounding and confirmation

The model must copy exact origin/destination evidence from the user's input. The server accepts the proposed place only when that evidence appears in the original text and resolves to the same place. Known Chinese/English city aliases are canonicalized. Concept phrases such as “a beach,” “somewhere warm,” Christmas atmosphere, or a place to hike are rejected as destinations even when a model incorrectly supplies them. Their controlled intent can still be preserved.

Exact date fields require complete ISO dates with an explicit year. A broad period is preserved in `departureWindowText`, and the structured date inputs remain marked for confirmation. Missing route, date, duration, budget, and rating fields are never copied from old form defaults.

If the LLM is missing, times out, returns an error, or produces malformed output, the browser uses `DemoPreferenceParser` and displays “local fallback.” The fallback is never labeled AI-generated. Parsing never starts destination discovery or a travel search.
