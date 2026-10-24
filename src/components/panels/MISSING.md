# Missing shared contracts — Agent 3

Read against src/types/domain.ts, src/fixtures/index.ts, and the current engine/store on October 24, 2026. No domain fields, enums, or engine actions are invented by the reduced panels.

## Shared pixel UI kit — owner: Agent 2 / kit owner

No exported PixelPanel, Button, Input, Slider, Bar, or Toast kit exists in the checkout or any fetched team branch, including upstream/main, agent1-core, agent4-flow, and frontendpixelart. Checked file paths and component exports. src/styles/pixel-tokens.css supplies tokens, not React components.

**Requested:** the canonical import path and supported component props. TODO(shared-ui-kit) marks the semantic shell/control boundaries. Until the owner supplies the kit, the reduced panels are an explicitly unskinned semantic integration scaffold. They add no local CSS, substitute pixel components, palette, gradients, shadows, fonts, or charts. Final pixel-kit acceptance remains blocked by this dependency.

## Live policy preview — owner: Agent 1

The engine does not export previewPolicy(state, draftPolicy), and no canonical preview result type exists. **Requested:** that selector, its return type, and which draft changes it supports. PolicyPreview renders a clearly labeled unavailable stub and never generates runway, cash buffer, 12-month balances, or other projection numbers. Every draft is a canonical Policy.

Policy has no discretionary budget or one-time debt payment field. Agent 1 must specify how those action drafts enter a preview; the UI does not append invented fields. The fetched engine branch now advertises previewMonth, but a one-month what-if is not the requested 12-month runway selector and is not available in this checkout's API. It is not mislabeled as a 12-month preview.

## Monthly pay summary — owner: Agent 1

Gross annual salary exists. selectMonthlyTakeHome requires an annual withholding total, but annualWithholding returns separate incomeTax/payroll components; there is no complete monthly salary/withholding/take-home selector. To obey the no-UI-financial-math restriction, Office uses recorded gross salary and withholding ledger rows and explicitly marks the take-home estimate unavailable until a complete engine summary exists. Requested: an engine selector returning the three monthly figures. No UI subtraction, division, tax brackets, or tax totals are implemented.

## Default app dev-route mount — owner: Agent 2

The root App has no router or /dev/stress-states hook. Agent 3 cannot edit App.tsx, main.tsx, or root Vite config. The folder-owned Vite config serves the exact dev route without editing them; StressStatesPage is also exported for the app owner to mount in the standard dev server. See README.md for the command.

## Canonical naming

The event action uses optionId (not choiceId): apply_event_option { eventId, optionId }. BuildingTarget is an alias of BuildingId and uses hospital (not insurance). InsuranceLine is health | auto | renters; separate home coverage does not exist. The reduced insurance decision is health only. The monthly investment contribution uses the existing set_contributions action separately from set_allocation; no combined action or pseudo-command is introduced.
