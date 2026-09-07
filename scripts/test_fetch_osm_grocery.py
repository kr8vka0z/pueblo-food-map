#!/usr/bin/env python3
"""Minimal stdlib-only regression check for fetch-osm-grocery.py's Fix 5
guard (a `remark` key in Overpass's response means a partial result, not a
real answer — see that script's own WHY comment on the check).

No pytest / requirements.txt in this repo for the Python scripts (checked;
ponytail rung 2/3 — `unittest` + `unittest.mock`, both stdlib, cover this).
Loaded by file path via importlib since the source file's name has a
hyphen and can't be a normal `import` target.

Run: `python3 scripts/test_fetch_osm_grocery.py`
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
import urllib.error
from unittest.mock import MagicMock, patch

MODULE_PATH = pathlib.Path(__file__).resolve().parent / "fetch-osm-grocery.py"
_spec = importlib.util.spec_from_file_location("fetch_osm_grocery", MODULE_PATH)
assert _spec and _spec.loader
fetch_osm_grocery = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fetch_osm_grocery)


def _make_response(payload: dict) -> MagicMock:
    """Build a fake urlopen() context manager returning `payload` as JSON."""
    resp = MagicMock()
    resp.read.return_value = json.dumps(payload).encode("utf-8")
    cm = MagicMock()
    cm.__enter__.return_value = resp
    cm.__exit__.return_value = False
    return cm


class OverpassRetryTest(unittest.TestCase):
    """2026-09-07: the scheduled refresh workflow died twice on GitHub-hosted
    runners with a bare HTTP 504 ~10s after the request, while the identical
    query from a home PC returns 200 in ~5s — a transient upstream/runner-side
    blip, not a bad query. An unattended monthly cron can't die on that."""

    def test_retries_on_transient_5xx_then_succeeds(self) -> None:
        errors = [
            urllib.error.HTTPError("https://overpass-api.de/api/interpreter", 504, "Gateway Timeout", None, None),
            urllib.error.HTTPError("https://overpass-api.de/api/interpreter", 502, "Bad Gateway", None, None),
        ]
        ok_response = _make_response({"elements": [{"id": 1}]})
        with (
            patch.object(fetch_osm_grocery.urllib.request, "urlopen", side_effect=[*errors, ok_response]) as mock_urlopen,
            patch.object(fetch_osm_grocery.time, "sleep") as mock_sleep,
        ):
            result = fetch_osm_grocery.fetch_overpass("fake query")

        self.assertEqual(result, {"elements": [{"id": 1}]})
        self.assertEqual(mock_urlopen.call_count, 3)
        self.assertEqual([c.args[0] for c in mock_sleep.call_args_list], [20, 40])

    def test_gives_up_after_max_attempts(self) -> None:
        error = urllib.error.HTTPError("https://overpass-api.de/api/interpreter", 504, "Gateway Timeout", None, None)
        with (
            patch.object(fetch_osm_grocery.urllib.request, "urlopen", side_effect=[error, error, error, error]) as mock_urlopen,
            patch.object(fetch_osm_grocery.time, "sleep") as mock_sleep,
        ):
            with self.assertRaises(urllib.error.HTTPError):
                fetch_osm_grocery.fetch_overpass("fake query")

        self.assertEqual(mock_urlopen.call_count, 4)
        self.assertEqual([c.args[0] for c in mock_sleep.call_args_list], [20, 40, 80])

    def test_does_not_retry_on_bad_query_400(self) -> None:
        error = urllib.error.HTTPError("https://overpass-api.de/api/interpreter", 400, "Bad Request", None, None)
        with (
            patch.object(fetch_osm_grocery.urllib.request, "urlopen", side_effect=error) as mock_urlopen,
            patch.object(fetch_osm_grocery.time, "sleep") as mock_sleep,
        ):
            with self.assertRaises(urllib.error.HTTPError):
                fetch_osm_grocery.fetch_overpass("fake query")

        self.assertEqual(mock_urlopen.call_count, 1)
        mock_sleep.assert_not_called()


class RemarkGuardTest(unittest.TestCase):
    def test_remark_key_aborts_and_writes_nothing(self) -> None:
        """A `remark` key means Overpass truncated the result — must fail
        loud and never write, or the truncated set gets diffed as if it
        were the whole county (see Fix 5's own comment for the consequence:
        plausible-looking removal proposals for venues that are still there)."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_root = pathlib.Path(tmp)
            dst = tmp_root / "pueblo-grocery.json"
            with (
                patch.object(fetch_osm_grocery, "REPO", tmp_root),  # DST.relative_to(REPO)'s print needs these to agree
                patch.object(fetch_osm_grocery, "DST", dst),
                patch.object(
                    fetch_osm_grocery,
                    "fetch_overpass",
                    return_value={"remark": "runtime error: Query timed out.", "elements": [{"id": 1}]},
                ),
            ):
                exit_code = fetch_osm_grocery.main()
            self.assertEqual(exit_code, 1)
            self.assertFalse(dst.exists())

    def test_clean_response_still_writes_normally(self) -> None:
        """Sanity check the guard is scoped to `remark` — a normal, complete
        response must still write exactly as before this fix."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_root = pathlib.Path(tmp)
            dst = tmp_root / "pueblo-grocery.json"
            with (
                patch.object(fetch_osm_grocery, "REPO", tmp_root),
                patch.object(fetch_osm_grocery, "DST", dst),
                patch.object(fetch_osm_grocery, "fetch_overpass", return_value={"elements": [{"id": 1}]}),
            ):
                exit_code = fetch_osm_grocery.main()
            self.assertEqual(exit_code, 0)
            self.assertTrue(dst.exists())


if __name__ == "__main__":
    sys.exit(unittest.main())
