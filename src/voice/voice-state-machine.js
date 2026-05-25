// Xiaozhi-style voice interaction state machine for BaiLongma.
// Browser-safe ES module: used by Electron renderer to keep mic/ASR/TTS state explicit.

export const VOICE_STATES = Object.freeze({
  IDLE: 'idle',
  LISTENING: 'listening',
  WAKE_DETECTED: 'wake_detected',
  RECORDING: 'recording',
  RECOGNIZING: 'recognizing',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  INTERRUPTED: 'interrupted',
  DONE: 'done',
  ERROR: 'error',
  EVENT: 'event',
})

const LEGACY_STATE_MAP = Object.freeze({
  processing: VOICE_STATES.THINKING,
  done: VOICE_STATES.DONE,
  event: VOICE_STATES.EVENT,
})

const ALLOWED_TRANSITIONS = Object.freeze({
  [VOICE_STATES.IDLE]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.SPEAKING,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.LISTENING]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.WAKE_DETECTED,
    VOICE_STATES.RECORDING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.SPEAKING,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.WAKE_DETECTED]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.RECORDING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.THINKING,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.RECORDING]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.RECORDING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.THINKING,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.RECOGNIZING]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.WAKE_DETECTED,
    VOICE_STATES.RECORDING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.THINKING,
    VOICE_STATES.DONE,
    VOICE_STATES.SPEAKING,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.THINKING]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.SPEAKING,
    VOICE_STATES.INTERRUPTED,
    VOICE_STATES.DONE,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.SPEAKING]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.RECORDING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.INTERRUPTED,
    VOICE_STATES.DONE,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.INTERRUPTED]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.RECORDING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.THINKING,
    VOICE_STATES.SPEAKING,
    VOICE_STATES.ERROR,
  ]),
  [VOICE_STATES.DONE]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.THINKING,
    VOICE_STATES.SPEAKING,
    VOICE_STATES.ERROR,
    VOICE_STATES.EVENT,
  ]),
  [VOICE_STATES.ERROR]: new Set([
    VOICE_STATES.IDLE,
    VOICE_STATES.LISTENING,
    VOICE_STATES.RECOGNIZING,
    VOICE_STATES.ERROR,
  ]),
  [VOICE_STATES.EVENT]: new Set(Object.values(VOICE_STATES)),
})

function normalizeState(state) {
  const s = LEGACY_STATE_MAP[state] || state
  return Object.values(VOICE_STATES).includes(s) ? s : VOICE_STATES.IDLE
}

function makeId(prefix, counter) {
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}

export function createVoiceStateMachine({ dispatchEvent = true } = {}) {
  let roundCounter = 0
  let sessionCounter = 0
  let snapshot = {
    state: VOICE_STATES.IDLE,
    previousState: null,
    reason: 'init',
    roundId: makeId('round', 0),
    asrSessionId: makeId('asr', 0),
    ttsSessionId: null,
    changedAt: Date.now(),
    transitionCount: 0,
  }
  const listeners = new Set()
  const history = []

  function emit(detail) {
    history.push(detail)
    if (history.length > 80) history.shift()
    for (const listener of listeners) {
      try { listener(detail) } catch {}
    }
    if (dispatchEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bailongma:voice-state', { detail }))
    }
  }

  function transition(nextState, meta = {}) {
    const normalized = normalizeState(nextState)
    const prev = snapshot.state
    const allowed = ALLOWED_TRANSITIONS[prev]?.has(normalized) ?? true
    const staleRound = meta.roundId && meta.roundId !== snapshot.roundId
    const staleAsr = meta.asrSessionId && meta.asrSessionId !== snapshot.asrSessionId
    const staleTts = meta.ttsSessionId && snapshot.ttsSessionId && meta.ttsSessionId !== snapshot.ttsSessionId
    if (staleRound || staleAsr || staleTts) {
      const rejected = {
        ...snapshot,
        requestedState: normalized,
        rejected: true,
        reason: meta.reason || 'stale event ignored',
        rejectedAt: Date.now(),
        staleRound,
        staleAsr,
        staleTts,
      }
      emit(rejected)
      return snapshot
    }
    snapshot = {
      ...snapshot,
      state: normalized,
      previousState: prev,
      reason: meta.reason || normalized,
      changedAt: Date.now(),
      transitionCount: snapshot.transitionCount + 1,
      allowed,
      meta: { ...meta },
    }
    emit(snapshot)
    return snapshot
  }

  function beginRound(reason = 'new round') {
    roundCounter += 1
    sessionCounter += 1
    snapshot = {
      ...snapshot,
      roundId: makeId('round', roundCounter),
      asrSessionId: makeId('asr', sessionCounter),
      ttsSessionId: null,
      reason,
      changedAt: Date.now(),
    }
    emit({ ...snapshot, event: 'round_start' })
    return snapshot
  }

  function beginAsrSession(reason = 'asr session start') {
    sessionCounter += 1
    snapshot = {
      ...snapshot,
      asrSessionId: makeId('asr', sessionCounter),
      reason,
      changedAt: Date.now(),
    }
    emit({ ...snapshot, event: 'asr_session_start' })
    return snapshot.asrSessionId
  }

  function beginTtsSession(reason = 'tts session start') {
    sessionCounter += 1
    snapshot = {
      ...snapshot,
      ttsSessionId: makeId('tts', sessionCounter),
      reason,
      changedAt: Date.now(),
    }
    emit({ ...snapshot, event: 'tts_session_start' })
    return snapshot.ttsSessionId
  }

  function clearTtsSession(reason = 'tts session clear') {
    snapshot = {
      ...snapshot,
      ttsSessionId: null,
      reason,
      changedAt: Date.now(),
    }
    emit({ ...snapshot, event: 'tts_session_clear' })
    return snapshot
  }

  return {
    getSnapshot: () => ({ ...snapshot }),
    getHistory: () => history.map(item => ({ ...item })),
    transition,
    setState: transition,
    beginRound,
    beginAsrSession,
    beginTtsSession,
    clearTtsSession,
    isCurrent: ({ roundId, asrSessionId, ttsSessionId } = {}) => {
      if (roundId && roundId !== snapshot.roundId) return false
      if (asrSessionId && asrSessionId !== snapshot.asrSessionId) return false
      if (ttsSessionId && snapshot.ttsSessionId && ttsSessionId !== snapshot.ttsSessionId) return false
      return true
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
