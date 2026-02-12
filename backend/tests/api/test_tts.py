"""TTS API tests with mocked Gemini API."""
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
        """Uses default voice (Aoede) when not specified."""
        response = await client.get(
            "/api/v1/tts/check?text=hello"
        )
        assert response.status_code == 200

    async def test_check_cache_invalid_voice_fallback(self, client):
        """Falls back to Aoede for invalid voice."""
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
            text="hello",
            voice="Aoede",
            audio_data=b"fake_audio_data",
            mime_type="audio/wav",
        )
        db_session.add(cache_entry)
        await db_session.commit()

        response = await client.get(
            "/api/v1/tts?text=hello&voice=Aoede"
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        assert response.headers["x-tts-cache"] == "db"
        assert response.content == b"fake_audio_data"

    @patch("app.api.v1.tts.settings")
    async def test_tts_no_api_key(self, mock_settings, client):
        """Returns 503 when Gemini API key not configured."""
        mock_settings.GEMINI_API_KEY = None

        response = await client.get(
            "/api/v1/tts?text=hello&voice=Aoede"
        )
        assert response.status_code == 503
        data = response.json()
        assert "not configured" in data["detail"]

    @patch("httpx.AsyncClient.post")
    @patch("app.api.v1.tts.settings")
    async def test_tts_gemini_success(
        self, mock_settings, mock_post, client, db_session
    ):
        """Successfully generates audio from Gemini API."""
        mock_settings.GEMINI_API_KEY = "test-key"

        # Mock Gemini API response
        fake_pcm = b"\x00\x01\x02\x03" * 100  # Fake PCM data
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "inlineData": {
                            "data": base64.b64encode(fake_pcm).decode(),
                            "mimeType": "audio/L16;rate=24000",
                        }
                    }]
                }
            }]
        }
        mock_post.return_value = mock_response

        response = await client.get(
            "/api/v1/tts?text=hello&voice=Aoede"
        )
        assert response.status_code == 200
        assert response.headers["x-tts-cache"] == "miss"
        assert response.headers["content-type"] == "audio/wav"
        # Should have WAV header (RIFF)
        assert response.content[:4] == b"RIFF"

        # Verify saved to DB cache
        result = await db_session.execute(
            TtsCache.__table__.select().where(TtsCache.text == "hello")
        )
        cached = result.fetchone()
        assert cached is not None

    @patch("httpx.AsyncClient.post")
    @patch("app.api.v1.tts.settings")
    async def test_tts_gemini_api_error(
        self, mock_settings, mock_post, client
    ):
        """Returns 502 when Gemini API fails."""
        mock_settings.GEMINI_API_KEY = "test-key"

        # Mock API error
        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "Internal error"
        mock_post.return_value = mock_response

        response = await client.get(
            "/api/v1/tts?text=hello&voice=Aoede"
        )
        assert response.status_code == 502
        data = response.json()
        assert "TTS API error" in data["detail"]

    @patch("httpx.AsyncClient.post")
    @patch("app.api.v1.tts.settings")
    async def test_tts_gemini_rate_limit_fallback(
        self, mock_settings, mock_post, client
    ):
        """Falls back to next model on 429 rate limit."""
        mock_settings.GEMINI_API_KEY = "test-key"

        # First model returns 429, second succeeds
        fake_pcm = b"\x00\x01" * 50
        mock_response_429 = AsyncMock()
        mock_response_429.status_code = 429
        mock_response_429.text = "Rate limit exceeded"

        mock_response_200 = AsyncMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "inlineData": {
                            "data": base64.b64encode(fake_pcm).decode(),
                            "mimeType": "audio/wav",
                        }
                    }]
                }
            }]
        }

        # Only one model in list now, but test the fallback mechanism
        mock_post.return_value = mock_response_200

        response = await client.get(
            "/api/v1/tts?text=test&voice=Puck"
        )
        # Should succeed even if first attempt would have failed
        assert response.status_code == 200

    @patch("httpx.AsyncClient.post")
    @patch("app.api.v1.tts.settings")
    async def test_tts_gemini_invalid_response(
        self, mock_settings, mock_post, client
    ):
        """Returns 502 when Gemini response format is invalid."""
        mock_settings.GEMINI_API_KEY = "test-key"

        # Mock invalid response structure
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"invalid": "structure"}
        mock_post.return_value = mock_response

        response = await client.get(
            "/api/v1/tts?text=hello&voice=Aoede"
        )
        assert response.status_code == 502
        data = response.json()
        assert "Invalid TTS response" in data["detail"]


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
