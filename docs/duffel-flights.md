# Duffel flight integration

Travel Scout's browser calls `POST /api/travel/flights/search`. The local Node server resolves the entered city or airport to a Duffel-compatible IATA city/airport code, creates a v2 round-trip offer request for one adult, chooses low-cost offers, and normalizes them into the existing `FlightQuote` contract. The server reads `DUFFEL_ACCESS_TOKEN`; the browser never receives it.

The implemented request uses Duffel's current offer-request flow: two slices (outbound and return), one adult passenger, economy cabin, at most one connection, and returned offers. The normalized quote retains both directions' dates/times, carrier data, segments and overnight evidence, total amount, original currency, source mode, and expiry.

## Local test-token setup

1. Create or sign in to a Duffel account at <https://app.duffel.com/>.
2. Keep the dashboard in Developer test mode.
3. Open **More → Developers → Access tokens** and create a test access token with permission to create flight offer requests. A test token begins with `duffel_test_`.
4. Copy `.env.example` to `.env` and set only the server variable:

   ```dotenv
   DUFFEL_ACCESS_TOKEN=duffel_test_your_token_here
   ```

5. Stop any older static preview, run `npm start`, and open <http://localhost:4173/>.
6. Select **Live** and search a supported origin/destination. Test results are labeled **Duffel test flights**; hotels remain **Demo / not yet live**.

The `.env` file is ignored by Git. Never add the token under `dist/`, to client JavaScript, to browser storage, or to a public build variable. Duffel test-mode offers are integration fixtures and are not suitable as real consumer prices.

## Location resolution

`server/location-resolver.js` uses an explicit allowlist and exact normalized aliases. City codes let Duffel consider the relevant metro airports: Shanghai maps to `SHA` (PVG/SHA), Tokyo to `TYO` (NRT/HND), Beijing to `BJS`, Osaka to `OSA`, Seoul to `SEL`, London to `LON`, and Paris to `PAR`. Guangzhou, Shenzhen, Chengdu, Hong Kong, Singapore, Bangkok, San Francisco, and common named-airport aliases are also supported. Unknown text is rejected; no place is guessed.

## Currency boundary

Duffel returns `total_amount` and `total_currency` in the organisation's configured billing currency. Travel Scout's deterministic engine accepts CNY only. A CNY offer becomes a scorable `price`; a foreign-currency offer keeps `originalPrice` and `originalCurrency`, sets `currencyConversionRequired`, and is withheld from scoring. If a response has no CNY offer, Live Mode reports that conversion is required. No exchange rate is invented.

## Failure behavior

Missing credentials, unresolved locations, Duffel HTTP/network failures, empty offer sets, malformed data, and foreign-currency-only results return a clear Live-data error. The UI removes any prior result and never substitutes Demo flight prices. The user can explicitly switch to Demo Mode.
