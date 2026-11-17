"""Tests for the current lyrics pipeline: LRCLIB-first, Groq fallback,
karaoke-captions line building, and symbol-word filtering.

Run with the server venv so `groq` is importable:
    server/.venv/Scripts/python.exe tests/test_lyric_timing.py
"""
import importlib.util
import io
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase, main, mock
import sys

SERVER_DIR = Path(__file__).resolve().parents[1] / 'server'
sys.path.insert(0, str(SERVER_DIR))

import lrclib
from lyric_timing import merge_words_into_segments


def load_server():
    spec = importlib.util.spec_from_file_location('lyrics_server_under_test', SERVER_DIR / 'server.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LrcLibMatchingTests(TestCase):
    def test_exact_title_artist_and_duration_match_scores_high(self):
        item = {'trackName': 'Closer', 'artistName': 'The Chainsmokers', 'duration': 244,
                'syncedLyrics': '[00:01.00]Hello'}
        score = lrclib.score_candidate(item, 'Closer', 'The Chainsmokers', 244)
        self.assertIsNotNone(score)
        self.assertGreaterEqual(score, 90)

    def test_wrong_artist_is_rejected(self):
        item = {'trackName': 'Closer', 'artistName': 'Some Cover Band', 'duration': 244,
                'syncedLyrics': '[00:01.00]Hello'}
        self.assertIsNone(lrclib.score_candidate(item, 'Closer', 'The Chainsmokers', 244))

    def test_wrong_version_duration_far_off_is_rejected(self):
        item = {'trackName': 'Closer', 'artistName': 'The Chainsmokers', 'duration': 190,
                'syncedLyrics': '[00:01.00]Hello'}
        self.assertIsNone(lrclib.score_candidate(item, 'Closer', 'The Chainsmokers', 244))

    def test_enhanced_lrc_word_tags_parse_to_word_times(self):
        lrc = '[00:01.00]<00:01.00>Never <00:01.40>gonna <00:02.10>give'
        segments = lrclib.parse_lrc_to_segments(lrc, 10)
        self.assertEqual([w['word'] for w in segments[0]['words']], ['Never', 'gonna', 'give'])
        self.assertEqual(segments[0]['words'][0]['start'], 1.0)
        self.assertEqual(segments[0]['words'][1]['start'], 1.4)

    def test_standard_lrc_estimates_word_times_weighted_by_length(self):
        lrc = '[00:01.00]i a veryveryverylongword'
        segments = lrclib.parse_lrc_to_segments(lrc, 10)
        words = segments[0]['words']
        self.assertEqual([w['word'] for w in words], ['i', 'a', 'veryveryverylongword'])
        self.assertEqual(words[0]['start'], 1.0)
        self.assertEqual(words[-1]['end'], segments[0]['end'])


class KaraokeLineTests(TestCase):
    def setUp(self):
        self.server = load_server()

    def test_symbol_only_tokens_are_dropped(self):
        words = [
            {'word': '🎵', 'start': 0.0, 'end': 0.5},
            {'word': '...', 'start': 0.5, 'end': 0.6},
            {'word': 'hello', 'start': 0.6, 'end': 1.0},
        ]
        lines = self.server.build_karaoke_lines(words)
        self.assertEqual([w['word'] for line in lines for w in line['words']], ['hello'])

    def test_oversized_word_is_capped_and_lines_do_not_overlap(self):
        words = [
            {'word': 'held', 'start': 0.0, 'end': 9.0},
            {'word': 'next', 'start': 9.1, 'end': 9.4},
        ]
        lines = self.server.build_karaoke_lines(words)
        held = lines[0]['words'][0]
        self.assertLessEqual(held['end'] - held['start'], 2.5)
        for before, after in zip(lines, lines[1:]):
            self.assertLessEqual(before['end'], after['start'])


class EndpointTests(TestCase):
    def setUp(self):
        self.server = load_server()

    def _post(self, server):
        with mock.patch.object(server, 'audio_duration', return_value=240), \
                server.app.test_client() as client:
            response = client.post('/transcribe', data={
                'audio': (io.BytesIO(b'fake audio'), 'song.mp3'),
                'title': 'Closer',
                'artist': 'The Chainsmokers',
                'duration': '244',
            }, content_type='multipart/form-data')
        return response

    def test_lrclib_studio_match_short_circuits_before_groq(self):
        server = self.server
        studio = {
            'source': 'lrclib', 'language': 'en', 'duration': 244,
            'segments': [{'start': 1.0, 'end': 4.0, 'text': 'Hey I', 'words': [
                {'word': 'Hey', 'start': 1.0, 'end': 1.6},
                {'word': 'I', 'start': 1.7, 'end': 2.0},
            ]}],
        }
        with mock.patch.object(server, 'fetch_synced_lyrics', return_value=studio), \
                mock.patch.object(server, 'client') as groq_client:
            groq_client.audio.transcriptions.create.side_effect = AssertionError('Groq must not run')
            response = self._post(server)
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['source'], 'lrclib-studio')
        self.assertEqual(payload['alignment'], 'studio-synced')
        self.assertEqual(payload['timingVersion'], 7)
        self.assertEqual(payload['segments'][0]['text'], 'Hey I')

    def test_groq_path_used_when_lrclib_has_no_match(self):
        server = self.server
        fake = SimpleNamespace(
            language='en',
            words=[
                {'word': 'hello', 'start': 0.5, 'end': 1.0},
                {'word': '🎵', 'start': 1.0, 'end': 1.2},
                {'word': 'world', 'start': 1.3, 'end': 1.9},
            ],
            segments=[],
        )
        with mock.patch.object(server, 'fetch_synced_lyrics', return_value=None), \
                mock.patch.object(server, 'compress_for_groq_if_needed', side_effect=lambda path: (path, False)), \
                mock.patch.object(server, 'client') as groq_client:
            groq_client.audio.transcriptions.create.return_value = fake
            response = self._post(server)
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['source'], 'groq-whisper-large-v3')
        self.assertEqual(payload['timingVersion'], 7)
        self.assertEqual([w['word'] for line in payload['segments'] for w in line['words']], ['hello', 'world'])


class SyncedLyricsSourceTests(TestCase):
    def test_wrong_version_length_is_rejected_by_duration_guard(self):
        segments = [{'end': 50.0}]
        self.assertFalse(lrclib._lrc_duration_ok(segments, 240))
        self.assertTrue(lrclib._lrc_duration_ok([{'end': 200.0}], 240))
        self.assertFalse(lrclib._lrc_duration_ok([{'end': 300.0}], 240))  # > duration + 30

    def test_synced_search_result_is_used_before_direct_lrclib(self):
        fake_lrc = '[00:01.00]hello\n[01:40.00]world'
        with mock.patch.object(lrclib, '_syncedlyrics_search', return_value=fake_lrc) as search_mock, \
                mock.patch.object(lrclib.urllib.request, 'urlopen', side_effect=AssertionError('direct LRCLIB must not run')):
            result = lrclib.fetch_synced_lyrics('Some Song', 'Some Artist', 240)
        self.assertEqual(result['source'], 'syncedlyrics')
        self.assertEqual([s['text'] for s in result['segments']], ['hello', 'world'])
        self.assertEqual(search_mock.call_count, 1)


class WordMergeTests(TestCase):
    def test_words_outside_model_line_are_visible_at_their_actual_onsets(self):
        words = [
            {'word': 'Hello', 'start': 3.12, 'end': 3.5},
            {'word': 'world', 'start': 4.2, 'end': 4.9},
        ]
        lines = merge_words_into_segments([{'start': 3.4, 'end': 4.6, 'text': 'Hello world'}], words)
        self.assertEqual(lines[0]['start'], 3.12)
        self.assertEqual(lines[0]['end'], 4.9)

    def test_words_without_segments_and_overlaps(self):
        lines = merge_words_into_segments([], [
            {'word': 'One', 'start': 1, 'end': 2.2},
            {'word': 'two', 'start': 2, 'end': 3},
            {'word': 'three', 'start': 8, 'end': 9},
        ])
        self.assertEqual(lines[0]['words'][0]['end'], 2)
        self.assertEqual(lines[0]['words'][1]['start'], 2)
        self.assertEqual(lines[1]['start'], 8)

    def test_line_only_result_does_not_invent_word_timings(self):
        segments = [{'start': 5, 'end': 8, 'text': 'A long held note'}]
        self.assertEqual(merge_words_into_segments(segments, []), segments)


if __name__ == '__main__':
    main()
