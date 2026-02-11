"""Gemini-TTS endpoint for natural sentence pronunciation."""
import base64
import struct
import re
from fastapi import APIRouter, Query, Response
from fastapi.responses import JSONResponse
import httpx
from app.core.config import settings

router = APIRouter(tags=["tts"])

GEMINI_TTS_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent"


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


@router.get("/tts")
async def text_to_speech(text: str = Query(..., max_length=500)):
    if not settings.GEMINI_API_KEY:
        return JSONResponse(status_code=503, content={"detail": "TTS not configured"})

    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": "Kore"}
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

    return Response(content=audio_bytes, media_type=mime, headers={
        "Cache-Control": "public, max-age=86400",
    })
