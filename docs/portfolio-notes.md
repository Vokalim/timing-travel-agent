# Timing · 途米 — Portfolio Notes

## 1. User problem

Travel planning often begins with incomplete intent: a month, a holiday, a mood, a budget, or a transport preference. Traditional booking forms make the user choose exact parameters too early and split destination research, price comparison, and itinerary work across separate products.

## 2. Product hypothesis

If a planning agent can accept partial intent, keep uncertainty visible, and progressively turn it into editable choices, users can make a confident travel decision without surrendering control or mistaking generated data for verified facts.

## 3. Core user flow

1. Describe a trip in natural language.
2. Review the interpreted origin, period, budget, destination state, and preferences.
3. Discover a diverse set of grounded destinations when no destination is provided.
4. Select a destination and compare representative date windows.
5. Review transport verification, stay-area guidance, and an itinerary outline.
6. Change dates, duration, pace, and daily activities inline.

Only origin is required before planning. Exact dates, destination, duration, and budgets can remain open.

## 4. Architecture

The static ES-module client owns presentation and reversible trip edits. A small Node HTTP server protects credentials and exposes same-origin routes for OpenAI and Duffel. Provider interfaces isolate flight, hotel, place, navigation, visual, and discovery sources. Normalized request and quote contracts keep the deterministic engine independent from a particular API.

## 5. Preference parsing

`PreferenceParser` supports an OpenAI implementation and a deterministic local fallback. The OpenAI route uses strict structured output. The normalized result distinguishes a real destination from a travel theme, preserves broad date language, records fields that need confirmation, and classifies free-text constraints as hard, strong, or soft. The UI labels fallback output and lets the user edit every interpreted field.

## 6. Destination Universe

The Destination Universe is a curated identity layer with canonical keys, English names, localized names, country metadata, airport/provider lookup data, traits, discovery tier, access hints, and visual categories. LLM proposals are grounded against this universe before provider checks. Presentation localization never changes provider lookup values.

## 7. Timing Engine

Broad periods such as December, Spring Festival, or “this weekend” become representative exploration windows. These windows are labeled provisional and remain editable. Deterministic comparison combines whole-trip cost, budget state, convenience, hotel rating, and preference fit. It never calls an LLM to compare numbers or choose BOOK / WAIT / CHANGE DATE.

## 8. Multimodal transport

The transport planner compares flight, rail, and self-drive suitability as separate modes. Duffel can verify supported flight routes in Live Mode. Rail and drive remain unpriced and unscheduled until dedicated providers exist. Unsupported or unverified modes are shown with lower visual priority and explicit status.

## 9. Itinerary planning

A curated place provider supplies known place identities and categories. The deterministic itinerary planner distributes places across days, follows explicit interests, and changes density for relaxed, balanced, intensive, and deep-dive pacing. User-added places remain marked unverified. Missing hours or route metrics stay null rather than being invented.

## 10. Safety and data-integrity decisions

- API credentials remain on the server.
- Mock flight prices never appear as live prices.
- Foreign-currency values are not treated as CNY without conversion.
- Live-provider failure preserves the destination and itinerary plan.
- Generated dates and inferred duration are labeled provisional.
- Provider errors are sanitized before reaching the consumer UI.
- Hotel, rail, navigation, and POI claims reflect their actual verification level.

## 11. Limitations

Live data currently covers Duffel flights only. Hotel inventory, rail schedules, route matrices, tolls, place opening hours, and booking are outside the MVP. Destination coverage is finite, currency conversion is absent, and the local fallback parser handles a narrower language range than the LLM.

## 12. Possible next steps

- Add a normalized hotel provider with live inventory and cancellation terms.
- Connect rail and route-matrix providers for supported regions.
- Add evaluated place data with opening hours and coordinates.
- Introduce saved trips and shareable decision summaries.
- Build an evaluation set for interpretation accuracy, ranking relevance, data provenance, and recovery from partial provider failure.
