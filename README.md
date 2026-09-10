# Travel Scout

A dependency-free MVP travel decision workspace with mock flights, hotels, and preference interpretation.

## Run and test

- `npm start` serves the app at http://localhost:4173.
- `npm test` runs the deterministic engine suite using Node's built-in test runner.
- No API keys, account, database, or build step is required.

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
    providers.js     FlightProvider and HotelProvider mock adapters
    engine.js        Validation, date enumeration, costs, scoring, decisions
tests/
  engine.test.js     Search flow and deterministic decision tests
.openai/hosting.json Sites static hosting configuration
```

## Data flow and boundaries

Form → validateTrip → PreferenceInterpreter → validatePreferences → flight/hotel providers → deterministic scoreQuote → recommendation → UI.

V1 uses a local keyword simulator rather than an actual LLM. It recognizes comfort/quality/luxury, value (default), and nonstop/direct flight requests. Other requests are not applied. The interface labels this limitation. To add an LLM, implement interpret(text) on a server, validate the returned {priority: 'comfort'|'value', nonstop: boolean}, and keep all prices, arithmetic, scores, and decisions outside that model. Never embed API secrets in client code. For a production interpreter, add schema constraints, prompt-injection evaluations, negation handling, uncertainty and user confirmation of extracted preferences.

MockFlightProvider.search(trip, date) and MockHotelProvider.search(trip, date) return normalized quotes. Replace them with server-side API adapters implementing the same shape. Normalize USD, taxes/fees, round-trip flight prices, and availability across every hotel night before scoring. Production adapters also need timeouts, rate limits, caching, partial-failure handling, quote expiry, and currency precision in integer minor units. No external travel APIs are called here. Google Fonts and an Unsplash photo are presentational resources.

## Assumptions and decision rules

One adult, one room; USD; flight budget is round-trip and hotel budget is nightly. Duration means hotel nights; return date = departure + nights. The flexible window is for departures, not the full trip. Mock rates are tax-inclusive; baggage, transfers, meals, and activities are excluded. There is no booking action or forecast.

All days in a 0–60 day departure window are evaluated; duration is 1–30 nights. Hotels below the rating minimum and flights violating nonstop are excluded. Each date chooses its best pair, ranking budget-eligible pairs first, then score descending, then total ascending. Global ranking follows the same rule, with earliest date breaking ties.

Total = round-trip flight + nightly hotel × nights. Each budget is enforced separately. Value = max(0, 1 − total / (1.5 × combined budget)); quality = rating / 5. Value preference weights these 80%/20%; comfort preference weights them 35%/65%. Scores are rounded to 0–100 and are preference-fit measures, not model confidence or probability.

BOOK: best qualifying choice, unless CHANGE DATE applies.
CHANGE DATE: best qualifying date differs from earliest departure and either saves at least 5% against that date's selected option or the earliest date fails the limits. With comfort priority this can cost more, which is displayed without claiming savings.
WAIT: no qualifying option exists. This means revise constraints or check later; it never predicts future price drops.

## Validation

Nine automated tests cover the complete search service flow, reproducible mock quotes, exact totals, BOOK/WAIT/CHANGE DATE, independent budgets, no matches, preference filtering, invalid inputs/model output, and year rollover. The UI marks edited results as stale and requires resubmission. Provider or interpreter errors show an error while retaining the last result.

## Interview demo

Start with the populated San Francisco → Tokyo example. Change departure dates or budgets and submit. Inspect a chart bar or table date to see the flight/hotel arithmetic. Set flight budget to $1 to show WAIT. Set minimum rating to 5 to show no matches. Enter 'comfort and nonstop flights' to show applied preferences. Expand the decision rules to discuss explainability, evaluation and integration boundaries.
