"""Gemini-TTS endpoint with persistent DB caching."""
import base64
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

GEMINI_TTS_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent"

# In-memory LRU cache (L1): fast access for recent requests
# DB cache (L2): persistent, survives restarts
_TTS_CACHE_MAX = 500
_TTS_CACHE_TTL = 3600
_tts_cache: OrderedDict[tuple[str, str], tuple[bytes, str, float]] = OrderedDict()


def pcm_to_wav(pcm_data: bytes, sample_rate: int = 24000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    """Wrap raw PCM bytes in a WAV header so browsers can play it."""
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


VOICES = ["Aoede", "Puck", "Charon", "Fenrir", "Leda"]


def _mem_cache_get(text: str, voice: str) -> tuple[bytes, str] | None:
    """L1: Get from in-memory cache."""
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
    """L1: Store in in-memory cache."""
    key = (text.lower().strip(), voice)
    _tts_cache[key] = (audio_bytes, mime, time.time())
    while len(_tts_cache) > _TTS_CACHE_MAX:
        _tts_cache.popitem(last=False)


async def _db_cache_get(db: AsyncSession, text: str, voice: str) -> tuple[bytes, str] | None:
    """L2: Get from DB cache."""
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
    """L2: Store in DB cache."""
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


@router.get("/tts/check")
async def check_tts_cache(
    text: str = Query(..., max_length=500),
    voice: str = Query("Aoede"),
    db: AsyncSession = Depends(get_db),
):
    """Check if TTS audio is cached (memory or DB)."""
    voice_name = voice if voice in VOICES else "Aoede"
    if _mem_cache_get(text, voice_name):
        return {"cached": True}
    if await _db_cache_get(db, text, voice_name):
        return {"cached": True}
    return {"cached": False}


@router.get("/tts")
async def text_to_speech(
    text: str = Query(..., max_length=500),
    voice: str = Query("Aoede"),
    db: AsyncSession = Depends(get_db),
):
    if not settings.GEMINI_API_KEY:
        return JSONResponse(status_code=503, content={"detail": "TTS not configured"})

    voice_name = voice if voice in VOICES else "Aoede"

    # L1: Check in-memory cache
    cached = _mem_cache_get(text, voice_name)
    if cached:
        return Response(content=cached[0], media_type=cached[1], headers={
            "Cache-Control": "public, max-age=86400",
            "X-TTS-Cache": "memory",
        })

    # L2: Check DB cache
    db_cached = await _db_cache_get(db, text, voice_name)
    if db_cached:
        audio_bytes, mime = db_cached
        # Promote to L1
        _mem_cache_set(text, voice_name, audio_bytes, mime)
        return Response(content=audio_bytes, media_type=mime, headers={
            "Cache-Control": "public, max-age=86400",
            "X-TTS-Cache": "db",
        })

    # L3: Call Gemini API
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

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{GEMINI_TTS_URL}?key={settings.GEMINI_API_KEY}",
            json=payload,
        )

    if resp.status_code != 200:
        return JSONResponse(status_code=502, content={"detail": "TTS API error"})

    data = resp.json()
    try:
        part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
        audio_bytes = base64.b64decode(part["data"])
        mime = part.get("mimeType", "")
    except (KeyError, IndexError):
        return JSONResponse(status_code=502, content={"detail": "Invalid TTS response"})

    # Gemini returns raw PCM (audio/L16) — wrap in WAV header for browser playback
    if "L16" in mime or "pcm" in mime:
        rate_match = re.search(r'rate=(\d+)', mime)
        sample_rate = int(rate_match.group(1)) if rate_match else 24000
        audio_bytes = pcm_to_wav(audio_bytes, sample_rate=sample_rate)
        mime = "audio/wav"

    # Save to L1 (memory) + L2 (DB)
    _mem_cache_set(text, voice_name, audio_bytes, mime)
    await _db_cache_set(db, text, voice_name, audio_bytes, mime)

    return Response(content=audio_bytes, media_type=mime, headers={
        "Cache-Control": "public, max-age=86400",
        "X-TTS-Cache": "miss",
    })
