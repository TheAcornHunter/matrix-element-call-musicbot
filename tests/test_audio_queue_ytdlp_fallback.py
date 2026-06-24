import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from audio_queue import AudioQueue

EXPECTED_YOUTUBE_EXTRACTOR_ARGS = AudioQueue._ytdlp_youtube_args()[1]


class FakeProcess:
    def __init__(self, returncode: int, *, stdout: bytes = b"", stderr: bytes = b""):
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr

    async def communicate(self):
        return self._stdout, self._stderr


class AudioQueueYtdlpFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_resolve_direct_stream_url_retries_without_extractor_args(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            queue = AudioQueue(Path(temp_dir), preroll_silence=0)
            runner = AsyncMock(
                side_effect=[
                    (
                        1,
                        "",
                        "ERROR: [youtube] 4Ba_qTPA4Ds: Requested format is not available. Use --list-formats for a list of available formats",
                    ),
                    (0, "https://stream.example/audio\n", ""),
                ]
            )

            with patch.object(queue, "_run_command", runner):
                ok, result = await queue._resolve_direct_stream_url("yt-dlp", "https://www.youtube.com/watch?v=4Ba_qTPA4Ds")

        self.assertTrue(ok)
        self.assertEqual(result, "https://stream.example/audio")
        self.assertEqual(runner.await_count, 2)
        self.assertIn("--extractor-args", runner.await_args_list[0].args)
        self.assertIn(EXPECTED_YOUTUBE_EXTRACTOR_ARGS, runner.await_args_list[0].args)
        self.assertNotIn("--extractor-args", runner.await_args_list[1].args)

    async def test_download_audio_retries_without_extractor_args(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            audio_dir = Path(temp_dir)
            queue = AudioQueue(audio_dir, preroll_silence=0)
            resolved = {
                "source_url": "https://www.youtube.com/watch?v=4Ba_qTPA4Ds",
                "title": "Example title",
                "duration": 42.0,
                "uploader": "Example uploader",
                "stream_url": None,
            }
            calls: list[tuple[str, ...]] = []

            async def fake_create_subprocess_exec(*cmd, **kwargs):
                calls.append(tuple(cmd))
                if len(calls) == 1:
                    return FakeProcess(
                        1,
                        stderr=b"ERROR: [youtube] 4Ba_qTPA4Ds: Requested format is not available. Use --list-formats for a list of available formats",
                    )

                output_pattern = Path(cmd[cmd.index("-o") + 1].replace("%(ext)s", "wav"))
                output_pattern.write_bytes(b"RIFF")
                return FakeProcess(0)

            def fake_which(value):
                return "/usr/bin/yt-dlp" if value == "yt-dlp" else None

            with (
                patch("audio_queue.shutil.which", side_effect=fake_which),
                patch.object(queue, "_resolve_media_info", AsyncMock(return_value=(True, resolved))),
                patch.object(queue, "get_audio_duration", return_value=42.0),
                patch("audio_queue.asyncio.create_subprocess_exec", new=fake_create_subprocess_exec),
            ):
                ok, result = await queue.download_audio("https://www.youtube.com/watch?v=4Ba_qTPA4Ds")

        self.assertTrue(ok)
        self.assertEqual(result["title"], "Example title")
        self.assertEqual(result["duration"], 42.0)
        self.assertEqual(len(calls), 2)
        self.assertIn("--extractor-args", calls[0])
        self.assertIn(EXPECTED_YOUTUBE_EXTRACTOR_ARGS, calls[0])
        self.assertNotIn("--extractor-args", calls[1])


if __name__ == "__main__":
    unittest.main()
