# Task Plan: v2.2.0 Major Voice Device Console

## Goal
Build a larger v2.2.0 milestone instead of publishing tiny releases. The milestone should make Xiaozhi-style external voice clients visible and operable from Brain UI, backed by `/voice/events` diagnostics, tests, and docs. Do not create a GitHub Release until the broader v2.2.0 feature set is ready.

## Current Phase
Checkpoint 2 complete; continue accumulating v2.2.0

## Phases

### Phase 1: Baseline and milestone scope
- [x] Confirm v2.1.240 clean baseline and GitHub release state
- [x] Record user release-cadence request: large milestone updates only
- [x] Select v2.2.0 first feature group: Brain UI external voice client diagnostics panel
- **Status:** complete

### Phase 2: Brain UI external clients panel
- [x] Add voice tab UI for `/voice/events/clients` summary, refresh, auto-refresh, and client cards
- [x] Fetch and render client identity, subscription, capabilities, negotiated audio mode, and lastSeenAt
- [x] Add resilient empty/error states for human debugging
- **Status:** complete

### Phase 3: Tests and docs for checkpoint
- [x] Extend brain-ui smoke server mocks and browser checks
- [x] Update progress docs and v2.2.0 development notes without creating release notes as final
- [x] Run relevant syntax and smoke tests
- **Status:** complete

### Phase 4: GitHub backup only
- [x] Commit v2.2.0 development checkpoint
- [x] Push to GitHub main for backup
- [x] Do not tag or create Release yet
- **Status:** complete

## Release Cadence
- User explicitly requested: “制作大版本更新，不要改动一点点就更新”.
- Therefore: accumulate v2.2.0 changes, commit/push for backup, but delay tag/Release/assets until the milestone is meaningfully complete.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npm run smoke:brain-ui` timed out waiting for graph | Full browser smoke after panel changes | Fixed by escaping release-note backticks in `app-shell.js`, serving `/src/voice/*` imports in smoke server, mocking voice local endpoints, and waiting on node-count stats. Smoke now passes. |

## Checkpoint 2: Brain UI smoke repair
- [x] Identify page bootstrap failure (`tts is not defined`) caused by unescaped backticks in settings release notes.
- [x] Fix app-shell template literal by replacing raw backtick API path with `<code>`.
- [x] Add missing static route for `/src/voice/*` modules in `smoke-brain-ui`.
- [x] Mock voice local endpoints used by the voice panel.
- [x] Verify `npm run smoke:brain-ui` passes and covers the new external clients panel.

## Checkpoint 3: Protocol diagnostics and human troubleshooting advice
- [x] Add protocol self-check button and diagnostics block to the Brain UI external clients panel.
- [x] Render WebSocket endpoint, clients endpoint, audio modes, and key capabilities from `/voice/events/protocol`.
- [x] Add per-client human advice for identity, capability, subscription, and binary mismatch issues.
- [x] Extend `smoke-brain-ui` mocks/assertions for protocol diagnostics and “链路正常” advice.
- [x] Verify brain-ui and voice event smoke suites.

## Checkpoint 4: Copyable device onboarding command
- [x] Add a generated local debug command based on protocol endpoint metadata.
- [x] Add “复制接入命令” action for external-client onboarding.
- [x] Add human guide block explaining the debug flow.
- [x] Extend brain-ui smoke to assert the guide command is rendered.
- [x] Verify brain-ui and voice event smoke suites.

## Checkpoint 5: LAN/device onboarding guide
- [x] Generate a LAN/ESP32 debug command with Mac LAN IP placeholder.
- [x] Render a device `client:hello` JSON handshake example.
- [x] Add guidance for token query string and negotiated audio mode.
- [x] Extend brain-ui smoke to assert LAN command and handshake example.
- [x] Verify brain-ui and voice event smoke suites.

## Checkpoint 6: Canonical onboarding endpoint
- [x] Add `GET /voice/events/onboarding` backend endpoint.
- [x] Add `client_onboarding` protocol capability and protocol endpoint metadata.
- [x] Return local/LAN URLs, CLI commands, `client:hello`, subscribe message, and token/LAN notes.
- [x] Update Brain UI to use backend onboarding data when available.
- [x] Extend mapping, voice-events, and brain-ui smoke coverage.
- [x] Verify all relevant smoke suites for this checkpoint.

## Checkpoint 7: Backend client health/advice diagnostics
- [x] Add backend `getVoiceEventClientHealth()` helper.
- [x] Include `health` and `advice` in `/voice/events/clients` and status `clientDetails`.
- [x] Expose health/advice in protocol diagnostics fields.
- [x] Update Brain UI to render backend health/advice.
- [x] Extend mapping, voice-events, and brain-ui smoke coverage.
- [x] Verify all relevant smoke suites.

## Checkpoint 8: Voice event history endpoint and timeline
- [x] Add `GET /voice/events/history` backend endpoint for recent raw + Xiaozhi-mapped voice events.
- [x] Add `event_history` protocol capability and `endpoints.history` metadata.
- [x] Support `limit` and `type` query params for focused debugging.
- [x] Add Brain UI recent voice events timeline with type filter, manual refresh, and auto-refresh.
- [x] Extend mapping, voice-events, and brain-ui smoke coverage for history endpoint/timeline.
- [x] Verify all relevant smoke suites.

## Checkpoint 9: Voice link summary and command center
- [x] Add `GET /voice/events/summary` backend endpoint.
- [x] Add `link_summary` protocol capability and `endpoints.summary` metadata.
- [x] Aggregate client counts, audio/binary subscriptions, recent wake/asr/tts/interrupt event counts, issues, and suggestions.
- [x] Add Brain UI “语音链路总控” card with health level, metrics, and human troubleshooting suggestions.
- [x] Refresh summary together with clients/history in auto-refresh mode.
- [x] Extend mapping, voice-events, and brain-ui smoke coverage.
- [x] Verify all relevant smoke suites.

## Checkpoint 10: One-click voice link self-check
- [x] Add `GET /voice/events/check` backend endpoint.
- [x] Add `link_self_check` protocol capability and `endpoints.check` metadata.
- [x] Evaluate protocol readiness, client connection, handshake, audio subscription, binary audio, recent events, and wake→ASR→TTS loop.
- [x] Return ordered self-check steps, overall status, next actions, onboarding commands, URLs, and summary snapshot.
- [x] Add Brain UI “一键自检” button and self-check result panel.
- [x] Extend mapping, voice-events, and brain-ui smoke coverage.
- [x] Verify all relevant smoke suites.

## Checkpoint 11: Copyable voice device onboarding package
- [x] Add `GET /voice/events/package` backend endpoint.
- [x] Add `onboarding_package` protocol capability and `endpoints.package` metadata.
- [x] Generate README, `.env.voice`, `client-hello.json`, `subscribe.json`, Node client example, ESP32 pseudo config, commands, and checklist.
- [x] Add Brain UI “生成接入包” action and expandable package files panel.
- [x] Extend mapping, voice-events, and brain-ui smoke coverage.
- [x] Verify all relevant smoke suites.

## Checkpoint 12: Post-v2.2.0 wake guard tuning foundation
- [x] Confirm v2.2.0 Release exists with source and bundle assets.
- [x] Clean local release output artifacts from the working tree.
- [x] Add persisted wake confidence, minimum command length, cooldown, and speaker-gated wake settings.
- [x] Add Brain UI controls and save/load wiring for the new wake guard settings.
- [x] Add `smoke:voice-config` coverage for new voice config fields.
- [x] Verify brain-ui and voice-config smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 13: Wire wake guard settings into actual recognition gating
- [x] Add shared wake guard helper for confidence scoring, min command length, cooldown, and speaker-gated wake decisions.
- [x] Load new wake guard settings in Brain UI voice panel runtime.
- [x] Apply guard to direct wake matches and wake-window follow-up commands.
- [x] Emit rejection details for diagnostics/history.
- [x] Add `smoke:wake-guard` coverage.
- [x] Verify wake guard, voice config, and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 14: Wake rejection diagnostics in summary/history
- [x] Aggregate recent wake rejected reasons and details in `/voice/events/summary`.
- [x] Convert wake guard reasons into human tuning suggestions.
- [x] Render wake rejection confidence/threshold/min-command/cooldown metadata in Brain UI history.
- [x] Render recent wake rejection advice cards in Brain UI voice link summary.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify voice-events, brain-ui, wake-guard, and voice-config smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 15: One-click wake tuning actions
- [x] Convert wake rejection reasons into bounded config patches.
- [x] Add `GET /voice/wake/tuning` for suggested safe actions.
- [x] Add `POST /voice/wake/tuning/apply` with field whitelist and `setVoiceConfig()` persistence.
- [x] Render one-click tuning actions in Brain UI voice link summary.
- [x] Sync applied backend settings into localStorage and refresh diagnostics.
- [x] Extend wake-guard, voice-events, and brain-ui smoke coverage.
- [x] Verify relevant smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 16: Wake tuning history and rollback
- [x] Record before/after/applied metadata for wake tuning apply actions.
- [x] Return recent wake tuning history from `GET /voice/wake/tuning`.
- [x] Add `POST /voice/wake/tuning/rollback` to restore latest or selected tuning record.
- [x] Render latest tuning record and rollback button in Brain UI.
- [x] Sync rollback result to localStorage and refresh diagnostics.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify voice-events, brain-ui, wake-guard, and voice-config smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 17: Wake tuning effect evaluation
- [x] Add arbitrary-window voice event metrics helper.
- [x] Capture before metrics when applying wake tuning.
- [x] Add `GET /voice/wake/tuning/evaluate` for before/after verdicts.
- [x] Include evaluation data in wake tuning history.
- [x] Render verdict and before/after counts in Brain UI.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify voice-events, brain-ui, wake-guard, and voice-config smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 18: Verdict-based wake tuning stability advice
- [x] Convert evaluation verdicts into keep/rollback/observe/wait advice.
- [x] Include advice metadata in tuning history and evaluate endpoint responses.
- [x] Render verdict styling and advice text in Brain UI.
- [x] Surface a rollback recommendation action for worse verdicts.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify voice-events, brain-ui, wake-guard, and voice-config smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 19: Safe wake auto-tuning policy
- [x] Add bounded auto-tuning state: enabled, min rejections, cooldown, hourly limit, last applied time.
- [x] Add `GET /voice/wake/tuning/auto` for policy state and eligibility.
- [x] Add `POST /voice/wake/tuning/auto` for safe policy updates.
- [x] Add `POST /voice/wake/tuning/auto/apply` for one eligible bounded automatic adjustment.
- [x] Render Brain UI “安全自动调参” policy panel.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify voice-events, brain-ui, wake-guard, and voice-config smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 20: Persist wake auto-tuning policy
- [x] Move wake auto-tuning policy from process-only API state into persisted voice config.
- [x] Clamp persisted auto-tuning enable, minimum rejection count, cooldown, hourly limit, and last-applied timestamp.
- [x] Update `/voice/wake/tuning/auto` to persist policy updates through `setVoiceConfig()`.
- [x] Update `/voice/wake/tuning/auto/apply` to persist the last automatic apply timestamp.
- [x] Extend voice-config and voice-events smoke coverage for persisted auto-tuning policy.
- [x] Verify config/API syntax plus voice-config, voice-events, brain-ui, and wake-guard smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.
