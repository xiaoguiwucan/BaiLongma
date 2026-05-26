#!/usr/bin/env python3
"""
BaiLongma 本地 SenseVoice 语音服务
- 使用 FunAudioLLM/SenseVoiceSmall（FunASR）做中文优先本地 ASR
- WebSocket 协议兼容原 whisper_server.py：
  * JSON {type:'config', lang}
  * PCM int16 mono 16kHz 二进制帧
  * JSON {type:'transcript', text, is_final:true}
"""

import argparse
import asyncio
import json
import os
import re
import sys
import math
from concurrent.futures import ThreadPoolExecutor

import numpy as np

try:
    import websockets
except ImportError:
    print("[语音] 缺少 websockets 包，请运行: pip install websockets", flush=True)
    sys.exit(1)

try:
    from funasr import AutoModel
    from funasr.utils.postprocess_utils import rich_transcription_postprocess
except ImportError:
    print("[语音] 缺少 FunASR/SenseVoice 依赖，请运行: pip install funasr modelscope huggingface_hub soundfile", flush=True)
    sys.exit(1)

try:
    from resemblyzer import VoiceEncoder, preprocess_wav
except Exception:
    VoiceEncoder = None
    preprocess_wav = None

try:
    from openwakeword.model import Model as OpenWakeWordModel
except Exception:
    OpenWakeWordModel = None

SAMPLE_RATE = 16000
CHUNK_SAMPLES = SAMPLE_RATE // 4

# SenseVoice 对静音幻觉比 Whisper 少，但仍先用能量门控过滤视频/环境音。
SILENCE_RMS_THRESHOLD = 0.0065
NEAR_SPEECH_RMS_THRESHOLD = 0.014
MIN_UTTERANCE_PEAK_RMS = 0.020
MIN_UTTERANCE_VOICED_CHUNKS = 2
MIN_UTTERANCE_SECONDS = 0.45
SILENCE_CHUNKS_TO_FLUSH = 5
MAX_BUFFER_SECONDS = 20
SPEAKER_VERIFY_THRESHOLD = 0.55
KWS_WINDOW_SECONDS = 1.6
KWS_MIN_SECONDS = 0.45
KWS_COOLDOWN_SECONDS = 0.55
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VOICEPRINT_PATH = os.path.join(PROJECT_ROOT, "data", "voiceprint.json")

_HALLUCINATION_FRAGMENTS = [
    "字幕", "翻译", "感谢收看", "感谢观看", "谢谢收看", "谢谢观看",
    "请订阅", "请关注", "点赞", "订阅", "转发", "打赏", "明镜", "栏目",
    "subtitles by", "thank you for watching", "please subscribe", "amara.org",
]
_HALLUCINATION_REGEXES = [
    r"(我不想说了|我只想说了|我想说了)[,，。.\s]*(.*?)(我不想说了|我只想说了|我想说了)",
    r"(嗨|嘿|喂)[,，。.\s]*(三毛|三猫)[,，。.\s]*",
]


def is_hallucination(text: str) -> bool:
    t = str(text or "").strip()
    if not t or len(t) <= 1:
        return True
    if re.match(r"^[\s\W]+$", t):
        return True
    tl = t.lower()
    if any(frag.lower() in tl for frag in _HALLUCINATION_FRAGMENTS):
        return True
    if any(re.search(pat, t, flags=re.I) for pat in _HALLUCINATION_REGEXES):
        return True
    segs = [s.strip() for s in re.split(r"[,，、。.！!？?\s]+", t) if s.strip()]
    if len(segs) >= 4 and len(set(segs)) <= 2:
        return True
    compact = re.sub(r"[\s,，、。.！!？?]+", "", t)
    for n in range(2, 9):
        for i in range(0, max(0, len(compact) - n * 3 + 1)):
            unit = compact[i:i + n]
            if len(set(unit)) > 1 and unit * 3 in compact:
                return True
    return False


def map_lang(lang: str) -> str:
    value = str(lang or "zh").lower()
    if value in ("zh", "zh-cn", "cn", "mandarin", "chinese"):
        return "zh"
    if value in ("zh-tw", "yue", "cantonese"):
        return "yue" if value == "yue" else "zh"
    if value.startswith("en"):
        return "en"
    if value.startswith("ja"):
        return "ja"
    if value.startswith("ko"):
        return "ko"
    return "auto"


class SenseVoiceServer:
    def __init__(self, host="127.0.0.1", port=3723, model_name="sensevoice-small"):
        self.host = host
        self.port = port
        self.model_name = model_name
        self.model = None
        self.speaker_encoder = None
        self.kws_models = {}
        self.voiceprint_data = self._load_voiceprint()
        self.voiceprint = self.voiceprint_data.get("centroid")
        self._executor = ThreadPoolExecutor(max_workers=1)

    def _normalize_emb(self, emb):
        emb = np.array(emb, dtype=np.float32)
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 0 else emb

    def _load_voiceprint(self):
        try:
            with open(VOICEPRINT_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            samples = []
            for raw in data.get("samples") or []:
                emb = self._normalize_emb(raw)
                if emb.size > 0:
                    samples.append(emb)
            if not samples and data.get("embedding"):
                emb = self._normalize_emb(data.get("embedding"))
                if emb.size > 0:
                    samples.append(emb)
            centroid = self._normalize_emb(np.mean(samples, axis=0)) if samples else None
            return {
                "centroid": centroid,
                "samples": samples,
                "threshold": float(data.get("threshold") or SPEAKER_VERIFY_THRESHOLD),
                "model": data.get("model") or "resemblyzer-ge2e",
                "createdAt": data.get("createdAt"),
                "updatedAt": data.get("updatedAt"),
            }
        except Exception:
            return {"centroid": None, "samples": [], "threshold": SPEAKER_VERIFY_THRESHOLD, "model": "resemblyzer-ge2e"}

    def _save_voiceprint(self, samples, calibration=None):
        os.makedirs(os.path.dirname(VOICEPRINT_PATH), exist_ok=True)
        norm_samples = [self._normalize_emb(s) for s in samples if np.array(s).size > 0]
        centroid = self._normalize_emb(np.mean(norm_samples, axis=0)) if norm_samples else None
        existing = {}
        try:
            with open(VOICEPRINT_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}
        payload = {
            "embedding": centroid.tolist() if centroid is not None else [],
            "samples": [s.tolist() for s in norm_samples],
            "sampleCount": len(norm_samples),
            "model": "resemblyzer-ge2e",
            "threshold": SPEAKER_VERIFY_THRESHOLD,
            "createdAt": existing.get("createdAt") or int(asyncio.get_event_loop().time()),
            "updatedAt": int(asyncio.get_event_loop().time()),
            "calibration": calibration or {},
        }
        with open(VOICEPRINT_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f)
        self.voiceprint_data = {"centroid": centroid, "samples": norm_samples, "threshold": SPEAKER_VERIFY_THRESHOLD, "model": "resemblyzer-ge2e"}
        self.voiceprint = centroid


    def _clear_voiceprint(self):
        try:
            if os.path.exists(VOICEPRINT_PATH):
                os.remove(VOICEPRINT_PATH)
        except Exception:
            pass
        self.voiceprint_data = {"centroid": None, "samples": [], "threshold": SPEAKER_VERIFY_THRESHOLD, "model": "resemblyzer-ge2e"}
        self.voiceprint = None
        return {"configured": False, "sampleCount": 0, "threshold": SPEAKER_VERIFY_THRESHOLD}

    def _get_speaker_encoder(self):
        if VoiceEncoder is None or preprocess_wav is None:
            raise RuntimeError("缺少声纹依赖，请运行: pip install resemblyzer webrtcvad-wheels")
        if self.speaker_encoder is None:
            print("[语音] 加载本地声纹模型…", flush=True)
            self.speaker_encoder = VoiceEncoder()
            print("[语音] 声纹模型加载完成", flush=True)
        return self.speaker_encoder

    def _speaker_embedding(self, audio_int16: np.ndarray):
        audio_f32 = audio_int16.astype(np.float32) / 32768.0
        wav = preprocess_wav(audio_f32, source_sr=SAMPLE_RATE)
        if len(wav) < SAMPLE_RATE * 0.8:
            raise RuntimeError("录音太短，请至少说 3-5 秒")
        emb = self._get_speaker_encoder().embed_utterance(wav)
        emb = np.array(emb, dtype=np.float32)
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 0 else emb

    def _speaker_similarity(self, audio_int16: np.ndarray):
        if self.voiceprint is None:
            return None
        emb = self._speaker_embedding(audio_int16)
        centroid_score = float(np.dot(emb, self.voiceprint))
        sample_scores = [float(np.dot(emb, s)) for s in self.voiceprint_data.get("samples", [])]
        best_score = max([centroid_score, *sample_scores]) if sample_scores else centroid_score
        return best_score, centroid_score, sample_scores

    def enroll_speaker(self, audio_int16: np.ndarray):
        # Split a longer enrollment into overlapping-ish segments so one noisy section does not dominate.
        total = len(audio_int16)
        min_len = int(SAMPLE_RATE * 1.2)
        if total < int(SAMPLE_RATE * 3.0):
            raise RuntimeError("录音太短，请至少连续说 5-8 秒")
        segments = []
        thirds = np.array_split(audio_int16, 3)
        for part in thirds:
            if len(part) >= min_len:
                segments.append(part)
        segments.append(audio_int16)
        embeddings = [self._speaker_embedding(seg) for seg in segments]
        calibration_scores = []
        if len(embeddings) > 1:
            centroid = self._normalize_emb(np.mean(embeddings, axis=0))
            calibration_scores = [float(np.dot(e, centroid)) for e in embeddings]
        calibration = {
            "selfMin": round(min(calibration_scores), 3) if calibration_scores else None,
            "selfAvg": round(float(np.mean(calibration_scores)), 3) if calibration_scores else None,
            "recommendedThreshold": 0.50 if calibration_scores and min(calibration_scores) < 0.58 else 0.55,
        }
        self._save_voiceprint(embeddings, calibration=calibration)
        return {
            "configured": True,
            "samples": int(total),
            "seconds": round(total / SAMPLE_RATE, 2),
            "embeddingSamples": len(embeddings),
            "calibration": calibration,
        }

    def verify_speaker(self, audio_int16: np.ndarray, threshold=SPEAKER_VERIFY_THRESHOLD):
        if self.voiceprint is None:
            return {"configured": False, "passed": False, "score": None, "reason": "未录入声纹"}
        score, centroid_score, sample_scores = self._speaker_similarity(audio_int16)
        return {
            "configured": True,
            "passed": score >= threshold,
            "score": round(score, 3),
            "centroidScore": round(centroid_score, 3),
            "sampleBestScore": round(max(sample_scores), 3) if sample_scores else None,
            "sampleCount": len(self.voiceprint_data.get("samples", [])),
            "threshold": threshold,
        }

    def load_model(self):
        default_local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "SenseVoiceSmall"))
        model_dir = os.environ.get("BAILONGMA_SENSEVOICE_MODEL_DIR") or (
            default_local_dir if os.path.exists(os.path.join(default_local_dir, "model.pt")) else "FunAudioLLM/SenseVoiceSmall"
        )
        device = os.environ.get("BAILONGMA_ASR_DEVICE", "cpu")
        hub = os.environ.get("BAILONGMA_ASR_HUB", "hf")
        print(f"[语音] 加载 SenseVoiceSmall 模型: {model_dir} (device={device})…", flush=True)
        kwargs = {"model": model_dir, "trust_remote_code": True, "device": device, "disable_update": True}
        if not os.path.isdir(model_dir):
            kwargs["hub"] = hub
        # 对实时短句，前端/服务端已经做了简单 VAD；不再启用 FunASR VAD，减少额外模型下载和延迟。
        self.model = AutoModel(**kwargs)
        print("[语音] SenseVoiceSmall 加载完成", flush=True)

    def _run_transcribe(self, audio_int16: np.ndarray, lang: str) -> str:
        try:
            audio_f32 = audio_int16.astype(np.float32) / 32768.0
            language = map_lang(lang)
            res = self.model.generate(
                input=audio_f32,
                cache={},
                language=language,
                use_itn=True,
                batch_size=1,
            )
            text = ""
            if isinstance(res, list) and res:
                text = str(res[0].get("text", ""))
            elif isinstance(res, dict):
                text = str(res.get("text", ""))
            text = rich_transcription_postprocess(text).strip()
            # SenseVoice 可能输出 <|zh|><|NEUTRAL|> 这类富标签；二次兜底清理。
            text = re.sub(r"<\|[^|]+\|>", "", text).strip()
            if is_hallucination(text):
                print(f"[语音] 过滤低质量输出: {repr(text[:60])}", flush=True)
                return ""
            return text
        except Exception as e:
            print(f"[语音] SenseVoice 识别错误: {e}", flush=True)
            return ""

    async def transcribe_async(self, audio_int16: np.ndarray, lang: str) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self._run_transcribe, audio_int16, lang)

    def _resolve_kws_model_path(self, model_path: str) -> str:
        raw = str(model_path or '').strip()
        if not raw:
            return ''
        if os.path.isabs(raw):
            return raw
        return os.path.abspath(os.path.join(PROJECT_ROOT, raw))

    def _load_openwakeword_model(self, model_path: str):
        resolved = self._resolve_kws_model_path(model_path)
        if OpenWakeWordModel is None:
            raise RuntimeError('缺少 openwakeword 依赖，请先安装 openwakeword，或切回文本唤醒。')
        if not resolved or not os.path.exists(resolved):
            raise RuntimeError(f'找不到 openWakeWord 模型: {resolved or model_path}')
        key = ('openwakeword', resolved)
        if key not in self.kws_models:
            print(f"[语音] 加载 openWakeWord 模型: {resolved}", flush=True)
            self.kws_models[key] = OpenWakeWordModel(wakeword_models=[resolved], inference_framework='onnx')
            print('[语音] openWakeWord 模型加载完成', flush=True)
        return self.kws_models[key], resolved

    def detect_kws(self, audio_int16: np.ndarray, engine='none', model_path='', threshold=0.5):
        engine = str(engine or 'none').strip().lower()
        threshold = max(0.10, min(0.99, float(threshold or 0.5)))
        if len(audio_int16) < int(SAMPLE_RATE * KWS_MIN_SECONDS):
            return {"type": "kws_result", "accepted": False, "engine": engine, "score": 0.0, "threshold": threshold, "reason": "kws audio too short"}
        if engine == 'openwakeword':
            model, resolved = self._load_openwakeword_model(model_path)
            audio = audio_int16.astype(np.int16)
            predictions = model.predict(audio)
            if isinstance(predictions, dict) and predictions:
                keyword, score = max(predictions.items(), key=lambda kv: float(kv[1] or 0.0))
                score = float(score or 0.0)
            else:
                keyword, score = os.path.basename(resolved), 0.0
            return {
                "type": "kws_result",
                "accepted": score >= threshold,
                "engine": engine,
                "word": keyword,
                "score": round(score, 4),
                "threshold": threshold,
                "runtime": "openwakeword",
                "reason": "kws matched" if score >= threshold else "kws below threshold",
            }
        if engine == 'sherpa-onnx':
            # sherpa-onnx KWS requires a tokens file + encoder/decoder/joiner or a complete keyword model set.
            # Keep the protocol explicit instead of pretending an arbitrary .onnx path is enough.
            raise RuntimeError('sherpa-onnx KWS 运行时需要完整 tokens/encoder/decoder/joiner 配置；当前请使用 openWakeWord 模型或文本唤醒。')
        raise RuntimeError('KWS 引擎未配置。')

    async def detect_kws_async(self, audio_int16: np.ndarray, engine='none', model_path='', threshold=0.5):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self.detect_kws, audio_int16, engine, model_path, threshold)

    async def handle(self, websocket):
        print("[语音] 客户端已连接", flush=True)
        buf = np.array([], dtype=np.int16)
        silence_count = 0
        voiced_chunks = 0
        utterance_peak_rms = 0.0
        lang = "zh"
        speaker_verify_enabled = False
        speaker_threshold = SPEAKER_VERIFY_THRESHOLD
        enrolling = False
        enroll_buf = np.array([], dtype=np.int16)
        kws_buf = np.array([], dtype=np.int16)
        kws_last_at = 0.0

        try:
            async for raw in websocket:
                if isinstance(raw, str):
                    try:
                        msg = json.loads(raw)
                        if msg.get("type") == "config":
                            lang = msg.get("lang", "zh") or "zh"
                            speaker_verify_enabled = bool(msg.get("speakerVerification"))
                            try:
                                speaker_threshold = float(msg.get("speakerThreshold") or SPEAKER_VERIFY_THRESHOLD)
                            except Exception:
                                speaker_threshold = SPEAKER_VERIFY_THRESHOLD
                            await websocket.send(json.dumps({
                                "type": "config_ok",
                                "lang": lang,
                                "engine": "sensevoice",
                                "speaker": {"configured": self.voiceprint is not None, "enabled": speaker_verify_enabled},
                            }))
                        elif msg.get("type") == "speaker_status":
                            await websocket.send(json.dumps({
                                "type": "speaker_status",
                                "configured": self.voiceprint is not None,
                                "sampleCount": len(self.voiceprint_data.get("samples", [])),
                                "threshold": self.voiceprint_data.get("threshold", SPEAKER_VERIFY_THRESHOLD),
                            }))
                        elif msg.get("type") == "speaker_clear":
                            result = self._clear_voiceprint()
                            await websocket.send(json.dumps({"type": "speaker_clear_ok", **result}))
                        elif msg.get("type") == "speaker_test_start":
                            enrolling = "test"
                            enroll_buf = np.array([], dtype=np.int16)
                            await websocket.send(json.dumps({"type": "speaker_test_started"}))
                        elif msg.get("type") == "speaker_test_finish":
                            enrolling = False
                            try:
                                threshold = float(msg.get("speakerThreshold") or speaker_threshold or SPEAKER_VERIFY_THRESHOLD)
                                result = await asyncio.get_event_loop().run_in_executor(self._executor, self.verify_speaker, enroll_buf, threshold)
                                await websocket.send(json.dumps({"type": "speaker_test_result", **result}))
                            except Exception as e:
                                await websocket.send(json.dumps({"type": "error", "message": f"声纹测试失败: {e}"}))
                            enroll_buf = np.array([], dtype=np.int16)
                        elif msg.get("type") == "speaker_enroll_start":
                            enrolling = True
                            enroll_buf = np.array([], dtype=np.int16)
                            await websocket.send(json.dumps({"type": "speaker_enroll_started"}))
                        elif msg.get("type") == "speaker_enroll_finish":
                            enrolling = False
                            try:
                                result = await asyncio.get_event_loop().run_in_executor(self._executor, self.enroll_speaker, enroll_buf)
                                await websocket.send(json.dumps({"type": "speaker_enroll_ok", **result}))
                            except Exception as e:
                                await websocket.send(json.dumps({"type": "error", "message": f"声纹录入失败: {e}"}))
                            enroll_buf = np.array([], dtype=np.int16)
                        elif msg.get("type") == "kws_detect":
                            now = asyncio.get_event_loop().time()
                            if now - kws_last_at < KWS_COOLDOWN_SECONDS:
                                continue
                            kws_last_at = now
                            try:
                                result = await self.detect_kws_async(
                                    kws_buf,
                                    msg.get("engine") or "none",
                                    msg.get("modelPath") or msg.get("model_path") or "",
                                    msg.get("threshold") or 0.5,
                                )
                                await websocket.send(json.dumps(result))
                            except Exception as e:
                                await websocket.send(json.dumps({
                                    "type": "kws_status",
                                    "ready": False,
                                    "engine": msg.get("engine") or "none",
                                    "threshold": msg.get("threshold") or 0.5,
                                    "reason": str(e),
                                }))
                        elif msg.get("type") == "flush":
                            if self._should_transcribe(buf, voiced_chunks, utterance_peak_rms):
                                speaker = self.verify_speaker(buf, speaker_threshold) if speaker_verify_enabled else {"passed": True}
                                if not speaker.get("passed", True):
                                    await websocket.send(json.dumps({"type": "speaker_rejected", **speaker}))
                                else:
                                    text = await self.transcribe_async(buf, lang)
                                    if text:
                                        await websocket.send(json.dumps({"type": "transcript", "text": text, "is_final": True, "speaker": speaker}))
                            buf = np.array([], dtype=np.int16)
                            silence_count = 0
                            voiced_chunks = 0
                            utterance_peak_rms = 0.0
                    except Exception:
                        pass
                    continue

                if not isinstance(raw, (bytes, bytearray)):
                    continue

                chunk = np.frombuffer(raw, dtype=np.int16)
                if len(chunk) == 0:
                    continue
                kws_buf = np.append(kws_buf, chunk)
                kws_max = int(SAMPLE_RATE * KWS_WINDOW_SECONDS)
                if len(kws_buf) > kws_max:
                    kws_buf = kws_buf[-kws_max:]

                if enrolling:
                    enroll_buf = np.append(enroll_buf, chunk)
                    continue
                rms = float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2))) / 32768.0
                is_near_speech = rms >= NEAR_SPEECH_RMS_THRESHOLD
                is_silent = rms < SILENCE_RMS_THRESHOLD

                if not is_silent:
                    buf = np.append(buf, chunk)
                    silence_count = 0
                    if is_near_speech:
                        voiced_chunks += 1
                    else:
                        voiced_chunks = max(voiced_chunks, 1)
                    utterance_peak_rms = max(utterance_peak_rms, rms)
                elif len(buf) > 0:
                    buf = np.append(buf, chunk)
                    silence_count += 1

                buf_seconds = len(buf) / SAMPLE_RATE
                should_flush_speech = silence_count >= SILENCE_CHUNKS_TO_FLUSH and buf_seconds > 0.25
                should_flush_max = buf_seconds >= MAX_BUFFER_SECONDS
                if should_flush_speech or should_flush_max:
                    if self._should_transcribe(buf, voiced_chunks, utterance_peak_rms):
                        speaker = self.verify_speaker(buf, speaker_threshold) if speaker_verify_enabled else {"passed": True}
                        if not speaker.get("passed", True):
                            await websocket.send(json.dumps({"type": "speaker_rejected", **speaker}))
                        else:
                            text = await self.transcribe_async(buf, lang)
                            if text:
                                await websocket.send(json.dumps({"type": "transcript", "text": text, "is_final": True, "speaker": speaker}))
                    buf = np.array([], dtype=np.int16)
                    silence_count = 0
                    voiced_chunks = 0
                    utterance_peak_rms = 0.0
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[语音] 连接异常: {e}", flush=True)
        print("[语音] 客户端已断开", flush=True)

    def _should_transcribe(self, buf, voiced_chunks, peak_rms):
        return (
            len(buf) >= int(SAMPLE_RATE * MIN_UTTERANCE_SECONDS)
            and voiced_chunks >= MIN_UTTERANCE_VOICED_CHUNKS
            and peak_rms >= MIN_UTTERANCE_PEAK_RMS
        )

    async def run(self):
        self.load_model()
        print(f"[语音] WebSocket 服务启动: ws://{self.host}:{self.port}", flush=True)
        async with websockets.serve(self.handle, self.host, self.port):
            await asyncio.Future()


def main():
    parser = argparse.ArgumentParser(description="BaiLongma SenseVoice 本地语音识别服务")
    parser.add_argument("--model", default="sensevoice-small", help="本地 ASR 模型名")
    parser.add_argument("--port", type=int, default=3723, help="WebSocket 端口")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    args = parser.parse_args()
    server = SenseVoiceServer(host=args.host, port=args.port, model_name=args.model)
    asyncio.run(server.run())


if __name__ == "__main__":
    main()
