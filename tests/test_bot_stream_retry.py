import asyncio
import sys
import unittest
from collections import deque
from types import ModuleType
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

nio_stub = ModuleType("nio")
nio_stub.AsyncClient = object
nio_stub.InviteMemberEvent = object
nio_stub.MatrixRoom = object
nio_stub.RoomMessageText = object
sys.modules.setdefault("nio", nio_stub)

from bot import IntegratedBot


class IntegratedBotStreamRetryTests(unittest.IsolatedAsyncioTestCase):
    def make_bot(self, *, retry_enabled: bool = True):
        bot = object.__new__(IntegratedBot)
        bot.config = SimpleNamespace(STREAM_RETRY_TO_FILE_ON_FAIL=retry_enabled)
        bot.audio_queue = SimpleNamespace(current=None, queue=deque(), loop_mode=False)
        bot.call_worker = SimpleNamespace(wait_for_playback_terminal=AsyncMock())
        bot._playback_lock = asyncio.Lock()
        bot._playback_generation = 3
        bot._current_track_started_at = 10.0
        bot._cancel_auto_advance = Mock()
        bot._advance_queue = AsyncMock()
        bot._retry_stream_track_as_file = AsyncMock()
        bot.send_message = AsyncMock()
        return bot

    async def test_worker_error_retries_stream_track_as_file(self):
        bot = self.make_bot()
        track = {
            "title": "Example title",
            "source_url": "https://www.youtube.com/watch?v=4Ba_qTPA4Ds",
            "stream_url": "https://rr.example/audio",
        }
        bot.audio_queue.current = track
        bot.call_worker.wait_for_playback_terminal.side_effect = RuntimeError("ffmpeg exited with code 1: 403")
        bot._retry_stream_track_as_file.return_value = True

        await IntegratedBot._wait_for_worker_playback(
            bot,
            "!room:test",
            expected_generation=3,
            expected_source=track["stream_url"],
        )

        bot._retry_stream_track_as_file.assert_awaited_once_with("!room:test", track)
        bot._advance_queue.assert_not_awaited()
        self.assertIs(bot.audio_queue.current, track)
        self.assertEqual(
            bot.send_message.await_args_list[0].args,
            ("!room:test", "⚠️ Stream failed. Retrying from cached file..."),
        )
        self.assertEqual(bot.send_message.await_args_list[0].kwargs, {"priority": "critical"})
        self.assertEqual(
            bot.send_message.await_args_list[1].args,
            ("!room:test", "▶️ Now playing: Example title"),
        )

    async def test_worker_error_clears_current_track_when_retry_fails(self):
        bot = self.make_bot()
        track = {
            "title": "Example title",
            "source_url": "https://www.youtube.com/watch?v=4Ba_qTPA4Ds",
            "stream_url": "https://rr.example/audio",
        }
        bot.audio_queue.current = track
        bot.call_worker.wait_for_playback_terminal.side_effect = RuntimeError("ffmpeg exited with code 1: 403")
        bot._retry_stream_track_as_file.return_value = False

        await IntegratedBot._wait_for_worker_playback(
            bot,
            "!room:test",
            expected_generation=3,
            expected_source=track["stream_url"],
        )

        bot._retry_stream_track_as_file.assert_awaited_once_with("!room:test", track)
        self.assertIsNone(bot.audio_queue.current)
        bot._advance_queue.assert_not_awaited()
        self.assertEqual(
            bot.send_message.await_args_list[-1].args,
            ("!room:test", "❌ Playback worker error: ffmpeg exited with code 1: 403"),
        )


if __name__ == "__main__":
    unittest.main()
