#!/bin/sh
# Update yt-dlp to the latest release on every container start.
# This ensures the YouTube extractor stays current with YouTube's
# evolving bot-detection measures, even on Docker images that were
# built weeks ago.  Failure is non-fatal: the version baked at image
# build time is used as a fallback.
pip install -q --upgrade yt-dlp 2>/dev/null || true
exec python3 main.py
