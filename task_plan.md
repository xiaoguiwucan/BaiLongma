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

## Checkpoint 21: Persist video playback voice wake protection settings
- [x] Add backend voice config fields for video duck, PTT, AEC, duck level, duck hold, and duck sensitivity.
- [x] Clamp all video voice protection settings to safe ranges.
- [x] Hydrate the Brain UI video playback voice settings from `/settings/voice`.
- [x] Mirror server video settings into localStorage so runtime media/voice logic uses the same values immediately.
- [x] Save video voice protection settings back through `/settings/voice` with the rest of voice settings.
- [x] Extend voice-config and brain-ui smoke coverage.
- [x] Verify syntax plus voice-config and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 22: Persist speaker verification strictness
- [x] Add backend voice config field for `speakerThreshold`.
- [x] Clamp speaker threshold to the UI-supported 0.45–0.80 range.
- [x] Hydrate the Brain UI “声纹严格度” slider from `/settings/voice`.
- [x] Mirror server speaker threshold into localStorage so local ASR websocket config uses the persisted value immediately.
- [x] Save speaker threshold through `/settings/voice` with the rest of voice settings.
- [x] Persist the speaker enrollment recommended threshold when calibration returns one.
- [x] Extend voice-config and brain-ui smoke coverage.
- [x] Verify syntax plus voice-config and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 23: Speaker verification rejection diagnostics
- [x] Count `speaker:accepted` and `speaker:rejected` in voice link summary metrics.
- [x] Keep recent speaker rejection details with score, threshold, reason, and user-facing advice.
- [x] Promote excessive speaker rejection into summary issues and suggestions.
- [x] Render speaker accepted/rejected metrics in Brain UI “语音链路总控”.
- [x] Render speaker rejection advice cards in Brain UI with score/threshold diagnostics.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 24: One-click speaker rejection tuning actions
- [x] Convert recent speaker rejection details into safe bounded tuning actions.
- [x] Suggest lowering `speakerThreshold` when rejected speaker scores indicate the threshold is too strict.
- [x] Suggest disabling “wake also requires speaker verification” as a wake-stage recovery action when appropriate.
- [x] Return combined wake + speaker tuning actions from `/voice/wake/tuning`.
- [x] Allow `speakerThreshold` through the safe apply whitelist and record it in tuning history/rollback metadata.
- [x] Mirror applied and rolled-back speaker threshold into Brain UI localStorage runtime settings.
- [x] Extend wake-guard, voice-events, and brain-ui smoke coverage.
- [x] Verify syntax plus wake-guard, voice-events, and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 25: Safe auto-tuning for speaker rejection
- [x] Include recent `speakerRejected` counts in automatic tuning top-reason selection.
- [x] Prefer the matching speaker tuning action when speaker rejection is the dominant failure mode.
- [x] Keep existing auto-tuning safety gates: explicit enable, minimum rejection count, cooldown, hourly limit, and safe patch availability.
- [x] Allow `/voice/wake/tuning/auto` to report speaker-rejection eligibility and selected action.
- [x] Allow `/voice/wake/tuning/auto/apply` to apply/record a speaker-threshold action and persist the last-applied timestamp.
- [x] Extend voice-events smoke coverage for speaker-rejection auto-tuning and auto-apply.
- [x] Verify syntax plus voice-events smoke suite.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 26: Speaker-aware tuning evaluation
- [x] Add speaker accepted/rejected counts to voice event metrics windows.
- [x] Add speaker acceptance rate to metrics windows.
- [x] Treat reduced speaker rejection or improved speaker acceptance rate as an improved tuning verdict.
- [x] Treat increased speaker rejection as a worse tuning verdict.
- [x] Generate speaker-specific evaluation advice for improved/worse speaker tuning outcomes.
- [x] Render speaker rejection before/after counts in Brain UI tuning history.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 27: Visible tuning change diff in Brain UI
- [x] Add field labels for voice tuning parameters.
- [x] Add human formatting for boolean, threshold, cooldown, and command-length values.
- [x] Render applied tuning changes as before → after chips in Brain UI tuning history.
- [x] Include both wake and speaker threshold changes in the diff display.
- [x] Style tuning diff chips to be readable inside the voice link command center.
- [x] Extend brain-ui smoke coverage for wake and speaker tuning diff rendering.
- [x] Verify syntax plus brain-ui smoke suite.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 28: Persist voice tuning history
- [x] Add persisted `wakeTuningHistory` to voice config.
- [x] Sanitize tuning history records before returning/saving them.
- [x] Limit persisted history to the latest 30 records.
- [x] Restore tuning history from config on API startup.
- [x] Persist tuning history whenever apply, rollback, or auto-tune creates a record.
- [x] Extend voice-config smoke coverage for trimming and metadata persistence.
- [x] Verify syntax plus voice-config smoke suite.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 29: Clear persisted tuning history
- [x] Add backend `POST /voice/wake/tuning/clear` endpoint.
- [x] Clear both in-memory and persisted `wakeTuningHistory`.
- [x] Return cleared record count and empty public history.
- [x] Add Brain UI “清空历史” action when tuning history exists.
- [x] Refresh the tuning panel after clearing history without changing current voice settings.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 30: Backend voice stability presets
- [x] Define recommended presets for quiet room, video anti-interference, strict speaker verification, and balanced use.
- [x] Add `GET /settings/voice/presets` to expose presets with labels/descriptions/patches.
- [x] Add `POST /settings/voice/preset/apply` to persist a selected preset safely.
- [x] Route preset application through `setVoiceConfig()` so existing bounds and sanitization still apply.
- [x] Extend voice-events smoke coverage for preset listing and application.
- [x] Verify syntax plus voice-events smoke suite.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 31: Voice stability presets in settings UI
- [x] Add a Brain UI “语音稳定性预设” panel inside voice settings.
- [x] Fetch `/settings/voice/presets` and render scenario cards with human-readable parameter chips.
- [x] Apply a selected preset through `POST /settings/voice/preset/apply`.
- [x] Sync returned wake, speaker, and video voice settings back into controls and localStorage immediately.
- [x] Style preset cards for clear scenario-based selection.
- [x] Extend brain-ui smoke coverage for preset rendering, apply feedback, UI values, and localStorage sync.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 32: Preset recommendation and current-state awareness
- [x] Add backend current preset detection for exact and near-match voice settings.
- [x] Add backend recommended preset metadata based on recent voice link summary and current config.
- [x] Return `currentPreset`, `recommended`, and a compact summary from `/settings/voice/presets`.
- [x] Return refreshed preset metadata after `/settings/voice/preset/apply`.
- [x] Render current/recommended preset hints in Brain UI settings.
- [x] Mark preset cards with “当前” and “推荐” badges.
- [x] Extend voice-events and brain-ui smoke coverage for preset metadata and UI badges.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 33: Local voice readiness doctor
- [x] Add backend `GET /voice/local/doctor` for local ASR readiness, wake guard, video guard, speaker gate, and recent loop checks.
- [x] Include local voice server status, persisted voice config, compact recent summary, checks, and next actions.
- [x] Add Brain UI “本地语音体检” panel below local ASR model/profile settings.
- [x] Render provider/model/process/wake/video/speaker/recent-loop checks with human next actions.
- [x] Add manual refresh for the local voice doctor.
- [x] Extend voice-events and brain-ui smoke coverage.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 34: One-click fixes for local voice doctor
- [x] Add safe fix action IDs to local voice doctor checks and next actions.
- [x] Add backend `POST /voice/local/doctor/fix` with a strict whitelist of safe repairs.
- [x] Support one-click repair for local SenseVoice mode, wake guard enablement, video-guard preset, and starting local voice service.
- [x] Return refreshed voice config and doctor result after each fix.
- [x] Render “一键修复” buttons inside Brain UI local voice doctor rows.
- [x] Sync repaired voice config back into UI controls/localStorage.
- [x] Extend voice-events and brain-ui smoke coverage for safe fixes and UI repair flow.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 35: Local voice doctor fix history
- [x] Persist `voiceLocalDoctorHistory` in voice config with sanitization and bounded retention.
- [x] Record before/after/applied metadata every time a local doctor safe fix runs.
- [x] Return recent fix records from `GET /voice/local/doctor` and `POST /voice/local/doctor/fix`.
- [x] Show recent local voice doctor fixes in Brain UI.
- [x] Extend voice-events smoke coverage for persisted fix history.
- [x] Extend brain-ui smoke coverage for recent fix history rendering.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 36: Rollback for local voice doctor fixes
- [x] Add backend rollback helper for local voice doctor fix records.
- [x] Add `POST /voice/local/doctor/rollback` to restore a selected or latest fix record's `before` snapshot.
- [x] Record rollback operations in `voiceLocalDoctorHistory` with `rollbackOf` metadata.
- [x] Preserve `rollbackOf` through voice config sanitization.
- [x] Add Brain UI rollback button on the latest repair history entry.
- [x] Sync rolled-back voice config into settings controls/localStorage and refresh the doctor panel.
- [x] Extend voice-events and brain-ui smoke coverage for rollback.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 37: Runtime speaker status in local voice doctor
- [x] Add backend runtime query for local ASR WebSocket `speaker_status`.
- [x] Include reachable/configured/sampleCount/threshold/detail in local voice doctor response.
- [x] Use runtime speaker status to warn when speaker verification is enabled but the local service reports no enrolled voiceprint.
- [x] Render runtime speaker service status in Brain UI local voice doctor.
- [x] Extend brain-ui smoke coverage for speaker service status rendering.
- [x] Extend voice-events smoke coverage for local-service-not-running speaker status.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 38: Unified backend speaker status endpoint
- [x] Add backend `GET /voice/local/speaker/status` using the same runtime `speaker_status` query as local voice doctor.
- [x] Return speaker runtime status, local ASR process status, and voice config in one response.
- [x] Replace Brain UI direct `ws://127.0.0.1:3723` speaker-status probing with the backend endpoint.
- [x] Show clearer speaker status text for unreachable service, enrolled sample count, threshold, and not-enrolled state.
- [x] Extend voice-events smoke coverage for the speaker status endpoint.
- [x] Extend brain-ui smoke coverage to verify settings speaker status uses backend runtime diagnostics.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 39: Speaker status contextual actions
- [x] Add contextual action buttons beside Brain UI speaker status: refresh, start service, and enroll shortcut.
- [x] Show “启动服务” when runtime speaker status reports local service unreachable.
- [x] Show “去录入” when local service is reachable but no voiceprint is enrolled.
- [x] Wire “启动服务” to `/voice/local/start` with the selected local model/profile.
- [x] Wire “去录入” to the existing enroll voiceprint action.
- [x] Extend brain-ui smoke coverage for action visibility when service is unreachable.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 40: Speaker status action feedback
- [x] Add user-visible feedback when the speaker-status “启动服务” action is clicked.
- [x] Surface backend start errors instead of silently retrying status refresh.
- [x] Refresh both speaker status and local voice doctor after a successful start request.
- [x] Extend brain-ui smoke coverage for start-service feedback and status transition.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 41: Clear and re-enroll voiceprint
- [x] Add `speaker_clear` command to the local SenseVoice WebSocket service.
- [x] Remove local `data/voiceprint.json` and reset in-memory voiceprint state when clearing.
- [x] Add backend `POST /voice/local/speaker/clear` with local-service-running guard.
- [x] Disable speaker verification after a successful clear to avoid rejecting all wake attempts.
- [x] Add Brain UI “清除声纹” action next to enroll/test controls.
- [x] Refresh speaker status and local voice doctor after clearing.
- [x] Extend brain-ui and voice-events smoke coverage.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 42: Offline voiceprint clear fallback
- [x] Add offline file deletion fallback for `POST /voice/local/speaker/clear`.
- [x] Delete `data/voiceprint.json` from the shared user data directory even when the local ASR WebSocket is stopped.
- [x] Prefer runtime `speaker_clear` when service is running, but fall back to offline deletion on timeout/error.
- [x] Keep disabling `speakerVerificationEnabled` after clear so users are not locked out by missing voiceprint.
- [x] Extend voice-events smoke coverage for offline clear success while local service is stopped.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 43: Voiceprint clear backup and restore
- [x] Backup `data/voiceprint.json` before offline/runtime clear removes it.
- [x] Retain the latest 5 voiceprint backups under `data/voiceprint-backups`.
- [x] Add backend `POST /voice/local/speaker/restore` to restore the latest voiceprint backup.
- [x] Re-enable speaker verification after a successful restore.
- [x] Show clearer clear feedback when a backup was created.
- [x] Add Brain UI “恢复备份” action beside voiceprint controls.
- [x] Extend brain-ui and voice-events smoke coverage for missing backup and restore flow.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 44: Selectable voiceprint backups
- [x] Add backend `GET /voice/local/speaker/backups` to list retained voiceprint backup metadata.
- [x] Allow `POST /voice/local/speaker/restore` to restore a selected backup by name, falling back to latest when omitted.
- [x] Add Brain UI backup selector beside “恢复备份”.
- [x] Refresh backup selector after clear and restore operations.
- [x] Extend brain-ui smoke coverage for selecting a backup before restore.
- [x] Extend voice-events smoke coverage for backup list endpoint.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 45: Local voice readiness wizard
- [x] Add backend guided local voice readiness state endpoint.
- [x] Add backend safe one-click local voice baseline apply endpoint.
- [x] Record readiness apply in local doctor history for audit/rollback context.
- [x] Add Brain UI “一键语音准备” panel with human-readable steps.
- [x] Sync controls and diagnostics after applying the readiness baseline.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 46: Speaker gate safe readiness
- [x] Add readiness step for speaker gate lockout safety.
- [x] Prevent one-click readiness from enabling speaker verification without an enrolled runtime voiceprint.
- [x] Add safe doctor fix to disable speaker gate and wake-speaker requirement together.
- [x] Add Brain UI readiness contextual actions for enroll/test/disable-lockout.
- [x] Extend smoke tests for safe speaker gate readiness behavior.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 47: Local voice self-test loop
- [x] Add backend timestamped local voice self-test session start endpoint.
- [x] Add backend self-test evaluator for wake/speaker/asr/tts recent events.
- [x] Add Brain UI “语音实测闭环” panel and start button.
- [x] Show user-facing instruction and recent event summary.
- [x] Extend backend and Brain UI smoke coverage for the self-test loop.
- [x] Verify syntax plus brain-ui and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 48: Reuse existing local voice service
- [x] Detect an already-open local ASR WebSocket port.
- [x] Adopt/reuse existing local voice service instead of spawning a duplicate process.
- [x] Preserve status metadata with `external: true` for adopted services.
- [x] Make stop tracking safe for externally adopted services.
- [x] Add voice manager smoke coverage for port reuse.
- [x] Verify syntax plus voice manager, brain-ui, and voice-events smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 49: Visible reused local voice service status
- [x] Show reused-service source in backend local doctor/readiness/self-test details.
- [x] Show reused-service source in Brain UI readiness, self-test, local doctor, speaker status, and start feedback.
- [x] Add user guidance that reused service will not be duplicate-started and should be stopped before model switching.
- [x] Extend Brain UI and voice-events smoke coverage for service source metadata.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 50: Reused service stop/restart controls
- [x] Add UI controls for stopping/cancelling tracking and restarting local voice service.
- [x] Make restart safe for externally adopted services without duplicate-starting on port 3723.
- [x] Add force restart metadata path in `/voice/local/restart`.
- [x] Show clear user feedback for external service tracking vs app-owned process stop.
- [x] Extend voice manager and Brain UI smoke coverage.
- [x] Verify syntax plus voice-manager, voice-events, and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 51: Local voice overview summary
- [x] Add backend `/voice/local/overview` aggregator for service/readiness/speaker/self-test state.
- [x] Add Brain UI “本地语音总览” card above local service controls.
- [x] Show level, summary, top issues, and primary next action.
- [x] Wire overview actions to one-click prepare/self-test/enroll flows.
- [x] Extend voice-events and Brain UI smoke coverage.
- [x] Verify syntax plus voice-events and brain-ui smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 52: Local voice diagnostics export
- [x] Add backend `GET /voice/local/diagnostics/package` to aggregate local voice troubleshooting state.
- [x] Include overview, readiness, doctor, speaker status, backup metadata, self-test metrics, recent voice events, app/runtime metadata, and sanitized voice settings.
- [x] Keep the export privacy-safe: no API key values, no raw audio, and no voiceprint file contents.
- [x] Add Brain UI “导出诊断包” action that copies the JSON package for troubleshooting.
- [x] Extend voice-events and Brain UI smoke coverage for the diagnostics package and copy flow.
- [x] Verify syntax plus smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 53: Speaker threshold calibration loop
- [x] Add backend `GET /voice/local/speaker/calibration` to recommend a safer threshold from a speaker test score and recent rejection scores.
- [x] Add backend `POST /voice/local/speaker/calibration/apply` to apply the recommended threshold and record local doctor history.
- [x] Bias calibration toward avoiding owner lockout when a real owner test fails, while keeping thresholds bounded.
- [x] Add Brain UI “校准阈值” panel with current/recommended threshold, reason, recent pass/reject counts, and apply/retest actions.
- [x] Sync speaker slider/localStorage/status/doctor/overview after applying calibration.
- [x] Extend voice-events and Brain UI smoke coverage for recommendation and apply flows.
- [x] Verify syntax plus smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 54: Microphone level self-check meter
- [x] Add live microphone level telemetry from the Brain UI voice panel.
- [x] Track current level, peak level, noise floor, active state, timestamp, and current trigger threshold.
- [x] Add a Brain UI “麦克风自检” meter in voice sensitivity settings with bar/threshold marker and human advice.
- [x] Add reset action for peak/noise floor so users can retest after moving closer or changing threshold.
- [x] Explain whether the mic is unheard, below threshold, or clearly crossing the threshold to separate mic problems from wake/speaker/ASR problems.
- [x] Extend Brain UI smoke coverage for live mic-level rendering.
- [x] Verify syntax plus smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 55: Microphone threshold calibration
- [x] Add one-click microphone trigger threshold calibration from the live mic self-check meter.
- [x] Recommend a bounded threshold from current/peak level and observed noise floor.
- [x] Lower the threshold when the user's peak voice is below or close to the current trigger threshold.
- [x] Raise the threshold when noise floor implies likely false triggers.
- [x] Sync the sensitivity slider, displayed value, localStorage, meter threshold marker, and user advice after calibration.
- [x] Extend Brain UI smoke coverage for threshold calibration and persisted value sync.
- [x] Verify syntax plus smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 56: Mic status in local voice overview
- [x] Surface live microphone self-check state in the “本地语音总览” card.
- [x] Show whether the microphone is inactive, below threshold, or clearly hearing the user.
- [x] Include peak/threshold numbers directly in the overview so users do not need to scroll to the sensitivity section first.
- [x] Refresh overview mic status from live `bailongma:mic-level` events with throttling.
- [x] Style mic status as ok/warn chips alongside existing overview issues and actions.
- [x] Extend Brain UI smoke coverage for mic status appearing in the overview.
- [x] Verify syntax plus smoke suites.
- [x] Push as a development checkpoint only, without tag/Release.

## Checkpoint 58 plan - v2.3.1 Mac Electron packaging release

- [x] Respond to cadence issue by choosing a real but bounded patch release.
- [x] Change packaging scripts from Windows-first to Mac-first while preserving Windows commands.
- [x] Add Mac icon and cross-platform clean script.
- [x] Update README / CHANGELOG / BACKUP / in-app update notes.
- [x] Run validation checks and smoke tests.
- [x] Build macOS Electron package.
- [x] Commit and push v2.3.1 changes.
- [x] Tag and create GitHub Release v2.3.1 with detailed notes and artifacts.


## Checkpoint 59 plan - Video/media pre-roll ASR gate

- [x] Add configurable video/music pre-roll ring buffer.
- [x] Gate ASR during media playback until near-field voice activity is confirmed.
- [x] Flush pre-roll chunks when opening the ASR gate so command prefixes are less likely to be lost.
- [x] Add settings controls and backend persistence for pre-roll enable/duration.
- [x] Include pre-roll in video guard preset and readiness/doctor checks.
- [x] Extend Brain UI smoke coverage.
- [x] Run broader voice smoke suites.
- [x] Commit and push as a development checkpoint.


## Checkpoint 60 plan - Voice debug observability

- [x] Add live mic/VAD numbers to voice debug panel.
- [x] Add wake accepted/rejected reason and confidence to voice debug panel.
- [x] Add speaker accepted/rejected score and threshold to voice debug panel.
- [x] Add media pre-roll/ASR gate state to voice debug panel.
- [x] Extend Brain UI smoke coverage for synthetic debug events.
- [x] Run broader checks.
- [x] Commit and push as a development checkpoint.
