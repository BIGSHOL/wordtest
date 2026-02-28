"""TTS endpoint: Edge TTS (primary) + Gemini TTS (fallback) with persistent DB caching."""
import base64
import io
import struct
import re
import time
import uuid
import logging
from collections import OrderedDict
from fastapi import APIRouter, Query, Response, Depends
from fastapi.responses import JSONResponse
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.tts_cache import TtsCache

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tts"])

# ── Edge TTS voices (Microsoft Neural - 고품질 무료) ──
EDGE_VOICES = {
    "Aria":   "en-US-AriaNeural",
    "Jenny":  "en-US-JennyNeural",
    "Guy":    "en-US-GuyNeural",
    "Ana":    "en-US-AnaNeural",
    "Andrew": "en-US-AndrewNeural",
}
DEFAULT_EDGE_VOICE = "en-US-AriaNeural"

# ── Gemini TTS (fallback) ──
GEMINI_TTS_MODELS = [
    "gemini-2.5-flash-preview-tts",
]
GEMINI_TTS_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_VOICES = ["Aoede", "Puck", "Charon", "Fenrir", "Leda"]

# ── Voice mapping: frontend voice name → Edge voice ──
def _resolve_edge_voice(voice: str) -> str:
    """Map frontend voice name to Edge TTS voice ID."""
    if voice in EDGE_VOICES:
        return EDGE_VOICES[voice]
    if voice.startswith("en-"):
        return voice
    return DEFAULT_EDGE_VOICE

# ── In-memory LRU cache (L1) ──
_TTS_CACHE_MAX = 500
_TTS_CACHE_TTL = 3600
_tts_cache: OrderedDict[tuple[str, str], tuple[bytes, str, float]] = OrderedDict()


def pcm_to_wav(pcm_data: bytes, sample_rate: int = 24000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_size, b'WAVE',
        b'fmt ', 16, 1, channels, sample_rate, byte_rate, block_align, bits_per_sample,
        b'data', data_size,
    )
    return header + pcm_data


def _mem_cache_get(text: str, voice: str) -> tuple[bytes, str] | None:
    key = (text.lower().strip(), voice)
    entry = _tts_cache.get(key)
    if entry is None:
        return None
    audio_bytes, mime, ts = entry
    if time.time() - ts > _TTS_CACHE_TTL:
        _tts_cache.pop(key, None)
        return None
    _tts_cache.move_to_end(key)
    return audio_bytes, mime


def _mem_cache_set(text: str, voice: str, audio_bytes: bytes, mime: str):
    key = (text.lower().strip(), voice)
    _tts_cache[key] = (audio_bytes, mime, time.time())
    while len(_tts_cache) > _TTS_CACHE_MAX:
        _tts_cache.popitem(last=False)


async def _db_cache_get(db: AsyncSession, text: str, voice: str) -> tuple[bytes, str] | None:
    normalized = text.lower().strip()
    result = await db.execute(
        select(TtsCache.audio_data, TtsCache.mime_type)
        .where(TtsCache.text == normalized, TtsCache.voice == voice)
    )
    row = result.first()
    if row:
        return row.audio_data, row.mime_type
    return None


async def _db_cache_set(db: AsyncSession, text: str, voice: str, audio_bytes: bytes, mime: str):
    normalized = text.lower().strip()
    cache_entry = TtsCache(
        id=str(uuid.uuid4()),
        text=normalized,
        voice=voice,
        audio_data=audio_bytes,
        mime_type=mime,
        audio_size=len(audio_bytes),
    )
    db.add(cache_entry)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("TTS cache write failed (possibly duplicate): %s / %s", normalized[:30], voice)


# ── Edge TTS generation ──
async def _generate_edge_tts(text: str, voice: str) -> tuple[bytes, str] | None:
    """Generate audio using Microsoft Edge TTS (free, high-quality Neural voices)."""
    try:
        import edge_tts
        edge_voice = _resolve_edge_voice(voice)
        communicate = edge_tts.Communicate(text, edge_voice, rate="-8%")

        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

        if audio_chunks:
            audio_bytes = b"".join(audio_chunks)
            return audio_bytes, "audio/mpeg"
        return None
    except Exception as e:
        logger.warning("Edge TTS failed for '%s': %s", text[:30], str(e))
        return None


# ── Gemini TTS generation ──
async def _generate_gemini_tts(text: str, voice: str) -> tuple[bytes, str] | None:
    """Generate audio using Gemini TTS API."""
    if not settings.GEMINI_API_KEY:
        return None

    voice_name = voice if voice in GEMINI_VOICES else "Aoede"
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": voice_name}
                }
            },
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        for model in GEMINI_TTS_MODELS:
            url = f"{GEMINI_TTS_BASE}/{model}:generateContent?key={settings.GEMINI_API_KEY}"
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                break
            logger.warning("Gemini TTS [%s] error %s: %s", model, resp.status_code, resp.text[:200])
            if resp.status_code not in (429, 503):
                break

    if not resp or resp.status_code != 200:
        return None

    try:
        data = resp.json()
        part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
        audio_bytes = base64.b64decode(part["data"])
        mime = part.get("mimeType", "")
    except (KeyError, IndexError):
        return None

    if "L16" in mime or "pcm" in mime:
        rate_match = re.search(r'rate=(\d+)', mime)
        sample_rate = int(rate_match.group(1)) if rate_match else 24000
        audio_bytes = pcm_to_wav(audio_bytes, sample_rate=sample_rate)
        mime = "audio/wav"

    return audio_bytes, mime


@router.get("/tts/check")
async def check_tts_cache(
    text: str = Query(..., max_length=500),
    voice: str = Query("Aria"),
    db: AsyncSession = Depends(get_db),
):
    """Check if TTS audio is cached (memory or DB)."""
    if _mem_cache_get(text, voice):
        return {"cached": True}
    if await _db_cache_get(db, text, voice):
        return {"cached": True}
    return {"cached": False}


@router.get("/tts")
async def text_to_speech(
    text: str = Query(..., max_length=500),
    voice: str = Query("Aria"),
    db: AsyncSession = Depends(get_db),
):
    # L1: Check in-memory cache
    cached = _mem_cache_get(text, voice)
    if cached:
        return Response(content=cached[0], media_type=cached[1], headers={
            "Cache-Control": "public, max-age=86400",
            "X-TTS-Cache": "memory",
        })

    # L2: Check DB cache
    db_cached = await _db_cache_get(db, text, voice)
    if db_cached:
        audio_bytes, mime = db_cached
        _mem_cache_set(text, voice, audio_bytes, mime)
        return Response(content=audio_bytes, media_type=mime, headers={
            "Cache-Control": "public, max-age=86400",
            "X-TTS-Cache": "db",
        })

    # L3: Generate new audio
    # Try Edge TTS first (free, high-quality, no quota limit)
    result = await _generate_edge_tts(text, voice)
    source = "edge"

    # Fallback to Gemini TTS
    if not result:
        result = await _generate_gemini_tts(text, voice)
        source = "gemini"

    if not result:
        return JSONResponse(status_code=502, content={"detail": "TTS generation failed"})

    audio_bytes, mime = result

    # Save to L1 (memory) + L2 (DB)
    _mem_cache_set(text, voice, audio_bytes, mime)
    await _db_cache_set(db, text, voice, audio_bytes, mime)

    return Response(content=audio_bytes, media_type=mime, headers={
        "Cache-Control": "public, max-age=86400",
        "X-TTS-Cache": "miss",
        "X-TTS-Source": source,
    })
