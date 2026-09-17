# Timing V2: provider boundary

The existing UI, mock prices, fallback parser, and deterministic decision rules are preserved. Live flight search is connected to Duffel, and natural-language trip input is connected to an LLM through local server boundaries; no hotel API has been integrated.

## Modules

```
UI (app.js): requested mode, loading/error state, result-source labeling
  -> LLMPreferenceParser -> POST /api/travel/preferences/parse
       -> server LLMPreferenceParser -> OpenAI Responses API
       -> strict schema + deterministic grounding/normalization
       -> explicitly labeled DemoPreferenceParser fallback on failure
  -> searchTravel(trip, mode, options) in travel-service.js
     -> createTravelProviders(mode) in providers/index.js
        Demo: MockFlightProvider + MockHotelProvider
        Live: LiveFlightProvider + MockHotelProvider
              -> LiveApiTransport
              -> POST /api/travel/flights/search
              -> DuffelFlightProvider + server-only token
     -> scout(trip, interpreter, flights, hotels) in engine.js
        -> preference interpretation and validation
        -> normalized quotes
        -> deterministic totals, budget checks, scoring and decisions
```

The scoring and recommendation algorithms remain unchanged. The trip parser fills the structured form for review; it never searches or decides. Request validation normalizes currency and guards destination-based searches. The model boundary can return only the strict preference schema. Server normalization drops ungrounded destinations, and quote validators strip vendor score/decision fields before the engine performs its own math.

`dist/lib/providers.js` remains a compatibility export for existing imports. Each provider implementation now has its own file under `dist/lib/providers/`.

## Common interfaces

Both demo and live implementations expose:

- `FlightProvider.search(trip, departure): Promise<FlightQuote[]>`
- `HotelProvider.search(trip, departure): Promise<HotelQuote[]>`

FlightQuote contains `id`, scorable CNY `price`, `stops`, origin/destination, outbound and return timing, carrier, segments, source/provider, original amount/currency, and expiry when supplied.
HotelQuote contains `id: string`, `name: string`, `nightly: number`, `rating: number`.

These shapes are documented with JSDoc in `contracts.js` and checked at provider boundaries. Both types use tax-inclusive CNY major units, preserving V1 arithmetic. Flight price is one adult's full round trip; stops is the maximum stops in either direction, so zero means both directions are nonstop. Hotel nightly is the full-stay room total divided by nights, and rating is a normalized guest review score from 1 to 5. A hotel star category must not be used in place of a guest rating. Missing ratings must not be guessed.

Validators reject nonpositive/nonfinite/string prices, invalid guest ratings, duplicate IDs, missing names, unreasonable stops, and oversized quote lists. Unknown fields are removed. These limits are safety bounds for this contract, not provider coverage guarantees.

## Modes and failure policy

Demo is the default and needs no network or keys for travel data. It preserves the original seeded date variation with synthetic CNY-scale amounts (not a live exchange-rate conversion); the default example still recommends November 9 for ¥8,897, saving ¥4,879 against the earliest date. External font/photo resources are decorative and not required for search.

The Live flight provider never imports mocks or synthesizes quotes. Selecting Live clears previous results and sends each planned date pair to the owned server. The server resolves supported cities, searches Duffel, and returns only normalized CNY flight quotes. Hotels remain the Demo provider and every Live result labels this mixed maturity explicitly. No prices, scores, or recommendation are shown when the flight search fails. The user can explicitly choose `Use Demo Mode`; both the selector and result-source labels then say Demo.

There is no automatic flight fallback. Any failed Duffel request on any candidate date fails the whole Live comparison rather than silently ranking mock or incomplete flight coverage. No offers is reported as a Live-data failure. An invalid mode is rejected.

The UI discards late results after a mode change. Result provenance comes from the completed search, not solely from the selector. Changes to inputs during a search leave the returned results marked stale.

## Owned-backend contract

The Node server implements `POST /api/travel/flights/search`. There is intentionally no live hotel route.

Request fields: `origin`, `destination`, `departure`, `returnDate`, `nights`, `adults: 1`, `rooms: 1`, `currency: "CNY"`.

Responses: `{ source: "duffel", sourceMode: "test" | "live", currency: "CNY", quotes: FlightQuote[] }`.

Duffel sandbox and production results retain `sourceMode: "test" | "live"` and the UI displays it. The backend authenticates to Duffel and normalizes response shapes. The token never crosses the server boundary.

The server returns a safe non-2xx response for absent credentials, unavailable providers, unresolved locations, empty results, and unsupported currencies. It never returns Demo flights from this route. The browser rejects malformed responses, aborts timed-out requests, and exposes the safe message instead of raw vendor details.

`LiveApiTransport` calls only the fixed same-origin flight route, never Duffel directly. It sends structured trip dates and locations but no natural-language notes, budget preferences, API tokens, or model output.

## Credentials and deployment

`.env.example` documents `DUFFEL_ACCESS_TOKEN`. It is outside `dist/`; the browser does not read environment files. Copy it to the gitignored `.env` and start the Node server to enable Live flight search locally.

For future local backend development, load a gitignored `.env` or `.dev.vars` using the chosen server runtime. For deployment, put vendor credentials in the hosting platform's server-side secret store. Never put them in `dist/`, HTML, browser storage, public build variables, or `.openai/hosting.json`.

The implemented server variables are `DUFFEL_ACCESS_TOKEN` and `OPENAI_API_KEY`; `OPENAI_PREFERENCE_MODEL` optionally overrides the default parser model. Hotel placeholders remain unused.

The checked-in Sites configuration remains static, so a hosted Live deployment will require moving the route to a server/Worker and storing the token in that platform's secret store. Local `npm start` already serves both the UI and route. Production should add rate limiting and operational controls before enabling real traffic.

## Before enabling real traffic

1. Resolve entered cities to airport/city codes and hotel geographies, asking users to resolve ambiguity.
2. Add vendor-specific adapters, availability across both flight legs and all hotel nights, tax/fee normalization, genuine guest-rating normalization, quote timestamps/expiry, and production-vs-sandbox provenance.
3. Migrate monetary arithmetic to integer minor units and define hotel-average rounding and nightly-budget semantics for varying nightly rates. Existing major-unit calculations and whole-yuan display intentionally remain unchanged in this refactor.
4. Add bounded search concurrency, cancellation of sibling requests, provider rate limits, caching, retry/backoff policy, authentication, server-side validation, redacted telemetry, and spending limits. The current engine retains its parallel date enumeration; do not enable it against paid suppliers without these controls.
5. Reprice selected offers before booking, and evaluate live coverage, ranking behavior, currency handling, source-mode transitions and failure paths end to end. No booking is implemented here.

## API shortlist

- **Duffel Flights**: offer search for round trips; developer test tokens support integration work. Use production tokens only for Live Mode and recheck offers because they expire. [Official getting-started guide](https://duffel.com/docs/guides/getting-started-with-flights).
- **Duffel Stays**: accommodation search/booking under the same vendor family; requires requesting Stays access. An alternative to using a second vendor, subject to access and coverage. [Official Stays guide](https://duffel.com/docs/guides/getting-started-with-stays).
- **Booking.com Demand API**: a hotel-focused alternative. Requires Managed Affiliate Partner registration, Partner Centre access after a contract, an API token, and affiliate ID; it is not an unrestricted self-serve API. [Official prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites).

Recommendation: evaluate Duffel Flights first, then compare Duffel Stays access/coverage with Booking.com Demand eligibility for hotels. Confirm current commercial terms and search limits before connecting any service. No accounts, paid services, or integrations were created in this refactor.

## Currency and optional destinations

`createTripRequest` in `dist/lib/trip-request.js` normalizes every search request to an explicit `currency: "CNY"` and a trimmed `destination: string | null`. It also exposes `destinationState: "provided" | "discovery_required"`. Omitting destination or passing an empty string produces null and the discovery-required state. The structured search still requires a destination; the engine and providers reject a destination-less search with a discovery-not-available message before requesting data. No discovery behavior was added.

Budgets and normalized quote amounts are numeric yuan major units. Every normalized flight/hotel quote carries `currency: "CNY"`; live envelopes must also declare CNY and contradictory quote currencies are rejected. Future vendor adapters must perform explicit conversion before returning this contract; no exchange rates are fetched or guessed. Demo fixture amounts were rescaled by a fixed factor of seven to preserve date comparisons with the corresponding example budgets; this is synthetic fixture design, not an exchange-rate assertion. The UI displays ¥ and labels CNY/RMB. Natural-language input accepts ¥, ￥, CNY, and RMB prefixes; dollar/foreign-currency budgets require confirmation in yuan instead of silent conversion.

The optional `travelIntents` array is normalized to `festive`, `beach`, `relaxation`, `hiking`, `food`, `culture`, `nature`, `snow_winter`, `shopping`, `family`, and `romantic`. They are metadata for future destination discovery only: current providers, scoring weights, budget checks, and BOOK/WAIT/CHANGE DATE rules do not use them.
