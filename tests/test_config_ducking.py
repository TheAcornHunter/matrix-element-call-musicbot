import os
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest.mock import patch

from config import Config


class ConfigDuckingTests(unittest.TestCase):
    def _make_config_file(self, body: str) -> Path:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        config_path = Path(temp_dir.name) / "config.toml"
        config_path.write_text(body, encoding="utf-8")
        return config_path

    def _load(self, toml_text: str) -> Config:
        config_path = self._make_config_file(toml_text)
        with patch.dict(os.environ, {"CONFIG_FILE": str(config_path)}, clear=False):
            for key in (
                "MATRIX_HOMESERVER",
                "MATRIX_USER_ID",
                "MATRIX_ACCESS_TOKEN",
                "DUCKING_ENABLED",
                "DUCK_TO_PERCENT",
                "DUCKING_ATTACK_MS",
                "DUCKING_RELEASE_MS",
                "DUCKING_HOLD_MS",
                "DUCKING_VAD_THRESHOLD",
                "DUCKING_MIN_ACTIVE_SPEAKERS",
            ):
                os.environ.pop(key, None)
            return Config()

    def test_ducking_defaults_when_section_missing(self):
        cfg = self._load(
            textwrap.dedent(
                """
                [matrix]
                homeserver = "https://matrix.example.org"
                user_id = "@bot:example.org"
                access_token = "token"
                """
            )
        )

        self.assertFalse(cfg.DUCKING_ENABLED)
        self.assertEqual(cfg.DUCK_TO_PERCENT, 35)
        self.assertEqual(cfg.DUCKING_ATTACK_MS, 120)
        self.assertEqual(cfg.DUCKING_RELEASE_MS, 500)
        self.assertEqual(cfg.DUCKING_HOLD_MS, 250)
        self.assertAlmostEqual(cfg.DUCKING_VAD_THRESHOLD, 0.015)
        self.assertEqual(cfg.DUCKING_MIN_ACTIVE_SPEAKERS, 1)

    def test_ducking_custom_values_and_clamp(self):
        cfg = self._load(
            textwrap.dedent(
                """
                [matrix]
                homeserver = "https://matrix.example.org"
                user_id = "@bot:example.org"
                access_token = "token"

                [audio.ducking]
                enabled = true
                duck_to_percent = 250
                attack_ms = 90
                release_ms = 640
                hold_ms = 350
                vad_threshold = 0.022
                min_active_speakers = 2
                """
            )
        )

        self.assertTrue(cfg.DUCKING_ENABLED)
        self.assertEqual(cfg.DUCK_TO_PERCENT, 200)
        self.assertEqual(cfg.DUCKING_ATTACK_MS, 90)
        self.assertEqual(cfg.DUCKING_RELEASE_MS, 640)
        self.assertEqual(cfg.DUCKING_HOLD_MS, 350)
        self.assertAlmostEqual(cfg.DUCKING_VAD_THRESHOLD, 0.022)
        self.assertEqual(cfg.DUCKING_MIN_ACTIVE_SPEAKERS, 2)


if __name__ == "__main__":
    unittest.main()
