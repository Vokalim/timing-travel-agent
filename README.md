# Timing · 途米

Timing · 途米 turns a loosely described travel idea into a reviewable plan across destination, timing, transport, stay area, and itinerary.

## What it does

A user can describe a trip in Chinese or English without knowing every search field. Timing interprets the request, asks at most one useful clarification, suggests destinations when needed, compares representative date windows, checks transport options, recommends a stay area, and builds an editable day plan.

The core flow is:

**idea → destination → timing → transport → stay → itinerary**

Users can refine dates, trip length, pace, and daily activities without starting over.

## Product problem

Travel search products usually expect users to know the destination, exact dates, duration, and budget before they begin. Many people only know a season, holiday, mood, transport preference, or rough amount. Timing treats those partial signals as a valid starting point. Optional fields improve the recommendation but do not block planning.

## Agent architecture

Timing separates language understanding from decisions that must remain repeatable.

**LLM responsibilities**

- Interpret natural-language trip requests into a strict preference schema.
- Separate a geographic destination from a theme such as “a beach.”
- Propose grounded destination candidates from the supported Destination Universe.
- Produce concise reasons for suggestions.

**Deterministic responsibilities**

- Normalize trip requests and preference strength.
- Enforce hard constraints such as direct-only or no overnight flights.
- Score and rank destination and date candidates.
- Compare whole-trip costs in CNY.
- Apply diversity reranking and preserve user edits.
- Build itinerary density from the selected pace.

**External providers**

- Duffel supplies round-trip flight offers in Live Mode when configured.
- Navigation links use AMap for mainland China and Google Maps elsewhere.
- Place and visual metadata come from checked-in curated catalogs.
- Hotel prices, train schedules, and route metrics are not live in this MVP.

Browser credentials are never used. The browser calls same-origin server routes, and provider adapters normalize results before deterministic planning consumes them.

## Key product decisions

- Optional dates, duration, and budgets do not block planning. Timing generates clearly labeled provisional windows and duration suggestions.
- Explicit preferences affect filtering and ranking. “Only direct” is a hard constraint; “prefer direct” is a strong preference.
- Destination discovery is broader than live flight-provider coverage. Unsupported transport stays visible as unverified rather than receiving fabricated data.
- Live, demo, partial, and unavailable data are presented separately.
- Currency remains explicit throughout the request and quote models. The decision engine only compares CNY values; foreign-currency quotes are excluded until conversion is available.
- A trip can be refined inline without discarding route or preference context.

## Tech stack

- Browser-native HTML, CSS, and ES modules
- Node.js HTTP server using built-in modules
- OpenAI Responses API with strict structured output for preference parsing and destination discovery
- Duffel Flights API behind a server-side adapter
- Node.js built-in test runner (`node:test`)
- No frontend framework or runtime package dependency

## Running locally

Requires a recent Node.js version that supports `--env-file-if-exists`.

```bash
cp .env.example .env
npm start
```

Open [http://localhost:4173](http://localhost:4173). Demo Mode works without credentials.

Run all automated checks with:

```bash
npm test
```

## Environment variables

Only variable names are listed here. Put local values in `.env` in the project root.

- `OPENAI_API_KEY`
- `OPENAI_PREFERENCE_MODEL`
- `OPENAI_DISCOVERY_MODEL`
- `DUFFEL_ACCESS_TOKEN`
- `PORT`
- `HOTEL_API_PROVIDER`
- `BOOKING_DEMAND_API_TOKEN`
- `BOOKING_AFFILIATE_ID`

The unused hotel placeholders in `.env.example` document a future integration boundary; the application does not consume them today.

## Current limitations

- Demo Mode uses deterministic mock flight and hotel prices.
- Live Mode retrieves Duffel flights only. Hotel inventory and hotel prices remain explicitly demo or unavailable.
- Train schedules, fares, driving times, tolls, and route matrices are not connected.
- Curated place records provide identity and category only; opening hours, ratings, coordinates, and live availability are left unverified unless a provider supplies them.
- Destination discovery is bounded by the checked-in Destination Universe and current airport resolver.
- Currency conversion is deliberately absent. Non-CNY flight quotes are retained as source data but are not scored as CNY.
- Recommendations support exploration and comparison; they do not book travel.

For a concise product and architecture case-study outline, see [docs/portfolio-notes.md](docs/portfolio-notes.md).
