# Travel Scout

A dependency-free travel decision workspace with separate Demo/Live providers and deterministic recommendations. Demo uses mock flights and hotels; Live uses server-side Duffel flight search while hotels remain explicitly Demo.

See [V2 architecture](docs/v2-architecture.md) for interfaces, failure policy, future endpoints, credential placement, and the API shortlist.

## Run and test

- `npm start` serves the app at http://localhost:4173.
- `npm test` runs the deterministic engine suite using Node's built-in test runner.
- Demo Mode requires no API key, account, database, or build step. Live flight search requires a server-side Duffel test token in `.env`.

## Implementation plan

1. Build a responsive trip-input and comparison workspace.
2. Isolate preference interpretation from deterministic calculations.
3. Compare every departure date through replaceable travel providers.
4. Test the main search flow, recommendation branches, and validation.

## Project structure

```
dist/
  index.html         Accessible form and application shell
  style.css          Responsive visual system
  app.js             Form state, results, date inspection
  lib/
    preferences.js   PreferenceInterpreter adapter + output validation
    preference-parser.js Local deterministic parser contract/fallback
    llm-preference-parser.js Browser adapter for server-side AI parsing
    providers.js     V1-compatible exports
    providers/       Separate mock/live flight and hotel adapters, contracts, transport
    travel-service.js Mode-based orchestration and result provenance
    engine.js        Validation, date enumeration, costs, scoring, decisions
server/
  server.js          Same-origin static server and travel API route
  travel-api.js      Request validation and safe HTTP responses
  duffel-flight-provider.js  Duffel v2 adapter and quote normalization
  location-resolver.js       Explicit city/airport to IATA resolver
  currency-normalizer.js     CNY-only scoring boundary
  preference-schema.js       Strict AI extraction schema
  preference-normalizer.js   Grounding and confirmation validation
  llm-preference-parser.js   OpenAI Responses API adapter
  preference-api.js          Same-origin parser endpoint
tests/
  engine.test.js     Existing search flow and deterministic decision tests
  providers.test.js  Mode isolation, contracts, live failures and transport tests
  duffel-flight-provider.test.js  Mocked Duffel, resolver, and currency tests
docs/
  v2-architecture.md Architecture and integration guide
.env.example         Server-only credential placeholders
.openai/hosting.json Sites static hosting configuration
```

## Data flow and boundaries

Form → validateTrip → PreferenceInterpreter → validatePreferences → flight/hotel providers → deterministic scoreQuote → recommendation → UI.

Natural-language trip input uses the OpenAI Responses API through the same-origin server route with strict Structured Outputs. The server validates and grounds the result before the browser receives it. It accepts a destination only when a corresponding place phrase occurs in the user's text; themes such as “a beach” stay in `travelIntents` with `destination: null`. Broad periods such as “December” remain text hints while exact date fields require confirmation. The UI fills a reviewable draft and never starts a search automatically.

If the AI route is unavailable or malformed, `FallbackPreferenceParser` runs the deterministic local parser and labels the result as a local fallback. It is never presented as AI output. `OPENAI_API_KEY` and the optional `OPENAI_PREFERENCE_MODEL` remain server-side. See [LLM preference parsing](docs/llm-preference-parser.md).

Demo and Live providers share `search(trip, departure)` and return the same validated quote shapes. `travel-service.js` chooses the pair and invokes the unchanged engine. Demo flight searches stay local. Live flight searches call the same-origin server, which resolves supported place names, creates Duffel offer requests, and returns normalized CNY quotes. Hotels remain the existing Demo provider in both modes and are labeled as such. A Live failure clears prices and recommendations; the user must explicitly choose Demo before synthetic flight prices return.

The same-origin API transport has timeout and error handling and rejects malformed responses. `DUFFEL_ACCESS_TOKEN` is read only by the Node server from a gitignored `.env`; it is never sent to browser code. See [Duffel flight setup](docs/duffel-flights.md).

## Assumptions and decision rules

One adult, one room; CNY; flight budget is round-trip and hotel budget is nightly. Duration means hotel nights; return date = departure + nights. The flexible window is for departures, not the full trip. Mock rates are tax-inclusive; baggage, transfers, meals, and activities are excluded. There is no booking action or forecast.

All days in a 0–60 day departure window are evaluated; duration is 1–30 nights. Hotels below the rating minimum and flights violating nonstop are excluded. Each date chooses its best pair, ranking budget-eligible pairs first, then score descending, then total ascending. Global ranking follows the same rule, with earliest date breaking ties.

Total = round-trip flight + nightly hotel × nights. Each budget is enforced separately. Value = max(0, 1 − total / (1.5 × combined budget)); quality = rating / 5. Value preference weights these 80%/20%; comfort preference weights them 35%/65%. Scores are rounded to 0–100 and are preference-fit measures, not model confidence or probability.

BOOK: best qualifying choice, unless CHANGE DATE applies.
CHANGE DATE: best qualifying date differs from earliest departure and either saves at least 5% against that date's selected option or the earliest date fails the limits. With comfort priority this can cost more, which is displayed without claiming savings.
WAIT: no qualifying option exists. This means revise constraints or check later; it never predicts future price drops.

## Validation

The automated suite covers the complete deterministic search flow, preference parsing, optional destinations, normalized travel intents, Demo/Live separation, shared quote contracts, and provider failures. Mocked LLM tests cover English and Chinese input, explicit and absent destinations, themes, missing budgets, broad dates, malformed output, unavailable service, grounding, and clearly labeled fallback. Mocked Duffel tests cover successful normalization, server-only credentials, API errors, empty results, supported and unresolved locations, request payloads, timing/segment preservation, and foreign-currency safety. Tests do not call OpenAI or Duffel networks.

## Interview demo

Start with the populated San Francisco → Tokyo example. Change departure dates or budgets and submit. Inspect a chart bar or table date to see the flight/hotel arithmetic. Set flight budget to ¥1 to show WAIT. Set minimum rating to 5 to show no matches. Enter 'comfort and nonstop flights' to show applied preferences. Expand the decision rules to discuss explainability, evaluation and integration boundaries.

To demonstrate mode safety without a token, select Live Mode: prices disappear and an unavailable notice appears. Choose Use Demo Mode to restore labeled mock flights and hotels. With a Duffel test token configured, Live Mode displays labeled Duffel test flights alongside the explicitly labeled Demo hotel data.
