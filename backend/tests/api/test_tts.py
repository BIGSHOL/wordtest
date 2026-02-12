"""TTS API tests with mocked Edge TTS and Gemini API."""
import pytest
import pytest_asyncio
import base64
from unittest.mock import AsyncMock, patch
from app.models.tts_cache import TtsCache


@pytest.mark.asyncio
class TestCheckTTSCache:
    """GET /api/v1/tts/check - check if audio is cached."""

    async def test_check_cache_not_found(self, client):
        """Returns cached=false when not in cache."""
        response = await client.get(
            "/api/v1/tts/check?text=hello&voice=Aoede"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["cached"] is False

    async def test_check_cache_found_in_db(self, client, db_session):
        """Returns cached=true when found in DB cache."""
        # Add to DB cache
        cache_entry = TtsCache(
            text="hello",
            voice="Aoede",
            audio_data=b"fake_audio_data",
            mime_type="audio/wav",
        )
        db_session.add(cache_entry)
        await db_session.commit()

        response = await client.get(
            "/api/v1/tts/check?text=hello&voice=Aoede"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["cached"] is True

    async def test_check_cache_default_voice(self, client):
        """Uses default voice (Aria) when not specified."""
        response = await client.get(
            "/api/v1/tts/check?text=hello"
        )
        assert response.status_code == 200

    async def test_check_cache_invalid_voice_fallback(self, client):
        """Falls back to default for invalid voice."""
        response = await client.get(
            "/api/v1/tts/check?text=hello&voice=InvalidVoice"
        )
        assert response.status_code == 200


@pytest.mark.asyncio
class TestTextToSpeech:
    """GET /api/v1/tts - generate TTS audio."""

    async def test_tts_returns_cached_from_db(self, client, db_session):
        """Returns cached audio from DB when available."""
        # Add to DB cache
        cache_entry = TtsCache(
            text="dbcache_test",
            voice="Aoede",
            audio_data=b"fake_audio_data",
            mime_type="audio/wav",
        )
        db_session.add(cache_entry)
        await db_session.commit()

        response = await client.get(
            "/api/v1/tts?text=dbcache_test&voice=Aoede"
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        assert response.headers["x-tts-cache"] == "db"
        assert response.content == b"fake_audio_data"

    @patch("app.api.v1.tts._generate_edge_tts", new_callable=AsyncMock, return_value=None)
    @patch("app.api.v1.tts._generate_gemini_tts", new_callable=AsyncMock, return_value=None)
    async def test_tts_no_api_key(self, mock_gemini, mock_edge, client):
        """Returns 502 when both Edge TTS and Gemini TTS fail."""
        from app.api.v1.tts import _tts_cache
        _tts_cache.clear()

        response = await client.get(
            "/api/v1/tts?text=noapi_unique&voice=Aoede"
        )
        assert response.status_code == 502
        data = response.json()
        assert "failed" in data["detail"].lower()

    @patch("app.api.v1.tts._generate_edge_tts", new_callable=AsyncMock, return_value=None)
    @patch("app.api.v1.tts._generate_gemini_tts", new_callable=AsyncMock)
    async def test_tts_gemini_success(
        self, mock_gemini, mock_edge, client, db_session
    ):
        """Successfully generates audio from Gemini TTS when Edge fails."""
        from app.api.v1.tts import _tts_cache
        _tts_cache.clear()

        # Mock Gemini returning WAV audio
        fake_wav = b"RIFF" + b"\x00" * 100
        mock_gemini.return_value = (fake_wav, "audio/wav")

        response = await client.get(
            "/api/v1/tts?text=gemini_unique&voice=Aoede"
        )
        assert response.status_code == 200
        assert response.headers["x-tts-cache"] == "miss"
        # Should have WAV header (RIFF)
        assert response.content[:4] == b"RIFF"

    @patch("app.api.v1.tts._generate_edge_tts", new_callable=AsyncMock, return_value=None)
    @patch("app.api.v1.tts._generate_gemini_tts", new_callable=AsyncMock, return_value=None)
    async def test_tts_gemini_api_error(
        self, mock_gemini, mock_edge, client
    ):
        """Returns 502 when both TTS engines fail."""
        from app.api.v1.tts import _tts_cache
        _tts_cache.clear()

        response = await client.get(
            "/api/v1/tts?text=apierr_unique&voice=Aoede"
        )
        assert response.status_code == 502
        data = response.json()
        assert "failed" in data["detail"].lower()

    @patch("app.api.v1.tts._generate_edge_tts", new_callable=AsyncMock, return_value=None)
    @patch("app.api.v1.tts._generate_gemini_tts", new_callable=AsyncMock, return_value=None)
    async def test_tts_gemini_invalid_response(
        self, mock_gemini, mock_edge, client
    ):
        """Returns 502 when Gemini response format is invalid."""
        from app.api.v1.tts import _tts_cache
        _tts_cache.clear()

        response = await client.get(
            "/api/v1/tts?text=invalid_unique&voice=Aoede"
        )
        assert response.status_code == 502
        data = response.json()
        assert "failed" in data["detail"].lower()


@pytest.mark.asyncio
class TestTTSCaching:
    """Test TTS caching behavior."""

    async def test_memory_cache_promotion(self, client, db_session):
        """DB cache hits are promoted to memory cache."""
        # Add to DB cache only
        cache_entry = TtsCache(
            text="cached_word",
            voice="Aoede",
            audio_data=b"test_audio",
            mime_type="audio/wav",
        )
        db_session.add(cache_entry)
        await db_session.commit()

        # First request - should hit DB cache
        response1 = await client.get(
            "/api/v1/tts?text=cached_word&voice=Aoede"
        )
        assert response1.status_code == 200
        assert response1.headers["x-tts-cache"] == "db"

        # Second request - should hit memory cache
        response2 = await client.get(
            "/api/v1/tts?text=cached_word&voice=Aoede"
        )
        assert response2.status_code == 200
        assert response2.headers["x-tts-cache"] == "memory"

    async def test_cache_normalization(self, client, db_session):
        """Cache keys are normalized (lowercase, trimmed)."""
        cache_entry = TtsCache(
            text="hello",
            voice="Aoede",
            audio_data=b"audio",
            mime_type="audio/wav",
        )
        db_session.add(cache_entry)
        await db_session.commit()

        # Should hit cache even with different case/whitespace
        response = await client.get(
            "/api/v1/tts?text=  HELLO  &voice=Aoede"
        )
        assert response.status_code == 200
        assert response.headers["x-tts-cache"] in ["db", "memory"]


@pytest.mark.asyncio
class TestVoiceHandling:
    """Test voice parameter handling."""

    async def test_valid_voices(self, client, db_session):
        """All valid voices are accepted."""
        voices = ["Aoede", "Puck", "Charon", "Fenrir", "Leda"]

        for voice in voices:
            # Add cache for each voice
            cache_entry = TtsCache(
                text="test",
                voice=voice,
                audio_data=b"audio",
                mime_type="audio/wav",
            )
            db_session.add(cache_entry)
        await db_session.commit()

        for voice in voices:
            response = await client.get(
                f"/api/v1/tts?text=test&voice={voice}"
            )
            assert response.status_code == 200

    async def test_text_length_limit(self, client):
        """Text parameter has max length validation."""
        long_text = "a" * 600  # Exceeds 500 char limit

        response = await client.get(
            f"/api/v1/tts?text={long_text}&voice=Aoede"
        )
        # Should return validation error (422)
        assert response.status_code == 422
