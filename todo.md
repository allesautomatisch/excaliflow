# Excaliflow / BPD TODO

Source of truth: `PLAN.md`.

## Milestone 1 (stabilize defaults + create flow)
- [ ] Smoke-test public demo (`http://159.223.250.129:8080`, basic auth) after latest changes
- [ ] Commit + push dev/typecheck fixes + proxy + vite config changes to `master`
- [ ] Verify BPD defaults on fresh load (font=Architect, strokeWidth=extraBold, arrowType=elbow)
- [ ] Click-to-create: confirm default size + auto-enter text reliably
- [ ] Reduce/noise: resolve remaining Vite warnings (circular imports), ensure dev server stays up

## Milestone 2 (new shapes/tools)
- [ ] Add Parallelogram tool (toolbar + element type + rendering + icons)
- [ ] Add Capsule/Pill tool (toolbar + element type + rendering + icons)

## Milestone 3 ("Add next step" handle)
- [ ] Add handle/button to create next step + elbow-arrow binding
- [ ] QoL: keyboard/flow optimizations for BPD

## Ops
- [ ] Keep Vite + Basic-auth proxy running; auto-restart if killed
- [ ] Keep TypeScript checker at 0 errors
