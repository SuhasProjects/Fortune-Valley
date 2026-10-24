# Remaining panel integration note

The engine dependencies previously requested here are resolved on shared main 81d020c:

- previewHorizon(state, PreviewOverrides, 12) provides canonical 12-month policy/household/insurance illustrations and months until emergency borrowing.
- applyAction plus previewMonth provides the one-time extra-payment illustration on a copy.
- selectPaySummary provides monthly gross, withholding, income/payroll tax and take-home.
- settleClaim provides the illustrative medical-bill comparison.

No missing engine fields, action names, or alternate domain shapes are introduced. Office and the policy preview no longer show unavailable stubs.

The only remaining design-system handoff is the shared React pixel UI kit requested from Agent 2 (PixelPanel/Button/Input/Slider/Bar/Toast). It was not present in the fetched shared main used for this pass. The latest user explicitly authorized the centered parchment skin in scroll-panel.css; that presentation is preserved without claiming to be the missing kit.

The stress route is available through the folder-owned Vite config documented in README.md, so no root-route edit is required for development. The latest integrator root browser selectors are compatible and all six root checks pass.
