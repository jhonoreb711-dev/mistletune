"""
MistleTunes Lyrics & Transcription Server
Powered by Groq Cloud (whisper-large-v3) with B-Venkatesh7210/karaoke-captions layout & LRCLIB studio sync.
Ultra-fast transcription (1-3s) with 0-delay millisecond word highlighting.
"""

import json
import math
import os
import re
import tempfile
import traceback
from pathlib import Path
from threading import Lock

import av
from flask import Flask, jsonify, request
from groq import Groq
from lrclib import fetch_synced_lyrics

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 105 * 1024 * 1024

CONFIG_PATH = Path(__file__).resolve().parent / 'config.json'
MAX_DURATION_SECONDS = 600   # 10 minutes
MAX_FILE_SIZE_MB = 100       # App upload limit (we compress if >24MB for Groq)
GROQ_LIMIT_MB = 24.0
TIMING_VERSION = 7
MODEL = 'whisper-large-v3'
_inference_lock = Lock()


def load_api_key():
    if CONFIG_PATH.is_file():
        try:
            with CONFIG_PATH.open(encoding='utf-8') as f:
                key = json.load(f).get('groq_api_key', '').strip()
            if key and key != 'YOUR_GROQ_API_KEY_HERE':
                return key
        except Exception:
            pass
    return os.environ.get('GROQ_API_KEY', '').strip() or None


GROQ_API_KEY = load_api_key()
if not GROQ_API_KEY:
    print('\n=======================================================')
    print('  [MistleTunes] Warning: No Groq API key in server/config.json')
    print('=======================================================\n')
    client = None
else:
    client = Groq(api_key=GROQ_API_KEY)
    print(f'[MistleTunes] Powered by Groq Cloud ({MODEL}) + karaoke-captions engine ⚡')


@app.after_request
def allow_app_origins(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({
        'status': 'ok',
        'model': MODEL,
        'provider': 'groq',
        'alignment': 'karaoke-captions',
        'timingVersion': TIMING_VERSION,
        'ready': bool(client),
    })


def audio_duration(path):
    with av.open(path) as container:
        stream = next((item for item in container.streams if item.type == 'audio'), None)
        if stream and stream.duration is not None and stream.time_base is not None:
            return float(stream.duration * stream.time_base)
        if container.duration is not None:
            return float(container.duration / av.time_base)
    raise ValueError('Could not read the audio duration.')


def compress_for_groq_if_needed(source_path):
    """If audio file exceeds Groq's 25MB limit, re-encode to 64k mono MP3."""
    size_mb = os.path.getsize(source_path) / (1024 * 1024)
    if size_mb <= GROQ_LIMIT_MB:
        return source_path, False

    compressed_path = source_path + '.groq.mp3'
    print(f'[MistleTunes] File is {size_mb:.1f} MB (exceeds 24 MB). Compressing for Groq...', flush=True)
    with av.open(source_path) as in_c, av.open(compressed_path, 'w', format='mp3') as out_c:
        in_stream = next(s for s in in_c.streams if s.type == 'audio')
        out_stream = out_c.add_stream('mp3', rate=16000)
        out_stream.bit_rate = 64000
        out_stream.layout = 'mono'
        resampler = av.AudioResampler(format='s16p', layout='mono', rate=16000)
        for packet in in_c.demux(in_stream):
            for frame in packet.decode():
                for resampled in resampler.resample(frame):
                    for out_pkt in out_stream.encode(resampled):
                        out_c.mux(out_pkt)
        for resampled in resampler.resample(None):
            for out_pkt in out_stream.encode(resampled):
                out_c.mux(out_pkt)
        for out_pkt in out_stream.encode(None):
            out_c.mux(out_pkt)
    return compressed_path, True


def build_karaoke_lines(raw_words, max_words=7, pause_break=0.5, sentence_break=True, line_hold=0.4):
    """
    Port of B-Venkatesh7210/karaoke-captions layout engine.
    Groups word-level timestamps into natural, breath-aligned karaoke lines.
    Ensures smooth continuous word-sweep transitions across adjacent words.
    """
    SENTENCE_END = ('.', '?', '!', '…')
    TRAILING_QUOTES = '\'"”’)]'

    clean_words = []
    for w in raw_words:
        text = str(w.get('word', w.get('text', '')) if isinstance(w, dict) else getattr(w, 'word', getattr(w, 'text', ''))).strip()
        start = round(float(w.get('start', 0) if isinstance(w, dict) else getattr(w, 'start', 0)), 3)
        end = round(float(w.get('end', start) if isinstance(w, dict) else getattr(w, 'end', start)), 3)
        # Cap oversized word boundaries where Whisper stretches across instrumental gaps
        if end - start > 2.5:
            end = round(start + min(end - start, max(1.2, len(text) * 0.35)), 3)
        # Filter music notes and Whisper background indicators
        if (text and text not in ('🎵', '🎶', '♪', '♫') and not re.match(r'^[\[\(].*?[\]\)]$', text)
                and end > start and re.search(r'[\w]', text, re.UNICODE)):
            clean_words.append({'word': text, 'start': start, 'end': end})

    clean_words.sort(key=lambda item: item['start'])
    if not clean_words:
        return []

    groups = []
    current = []

    for i, word in enumerate(clean_words):
        current.append(word)
        nxt = clean_words[i + 1] if i + 1 < len(clean_words) else None

        ends_sent = word['word'].rstrip(TRAILING_QUOTES).endswith(SENTENCE_END)
        pause = (nxt['start'] - word['end'] >= pause_break) if nxt else False

        if len(current) >= max_words or (sentence_break and ends_sent) or pause:
            groups.append(current)
            current = []

    if current:
        groups.append(current)

    lines = []
    for idx, group in enumerate(groups):
        line_start = group[0]['start']
        line_end = group[-1]['end']

        # karaoke-captions line_hold: extend line visibility until next line begins
        if line_hold > 0:
            next_start = groups[idx + 1][0]['start'] if idx + 1 < len(groups) else None
            line_end += line_hold
            if next_start is not None:
                line_end = min(line_end, next_start)

        # Legato micro-gap glide: connect words only across quick vocal gaps (<=0.20s).
        # Breath pauses and musical rests (>0.20s) turn off cleanly at the true acoustic end!
        word_list = []
        for j, w in enumerate(group):
            nxt_w_start = group[j + 1]['start'] if j + 1 < len(group) else w['end']
            gap = nxt_w_start - w['end']
            smooth_end = nxt_w_start if (0 <= gap <= 0.20) else w['end']
            smooth_end = min(smooth_end, line_end)
            word_list.append({
                'word': w['word'],
                'start': w['start'],
                'end': round(smooth_end, 3),
            })

        lines.append({
            'start': round(line_start, 3),
            'end': round(max(line_end, word_list[-1]['end']), 3),
            'text': ' '.join(w['word'] for w in group),
            'words': word_list,
        })

    # Enforce non-overlapping segment boundaries for validSegments()
    lines.sort(key=lambda s: s['start'])
    for i in range(len(lines) - 1):
        if lines[i]['end'] > lines[i + 1]['start']:
            lines[i]['end'] = lines[i + 1]['start']
            for w in lines[i]['words']:
                w['end'] = min(w['end'], lines[i]['end'])

    return [l for l in lines if l['end'] > l['start'] and l['text'].strip()]


def clean_and_validate_segments(segments):
    """Sort and prevent overlapping boundaries to satisfy validSegments()."""
    if not segments:
        return []
    segments.sort(key=lambda s: s['start'])
    for i in range(len(segments) - 1):
        if segments[i]['end'] > segments[i + 1]['start']:
            segments[i]['end'] = segments[i + 1]['start']
            for w in segments[i].get('words', []):
                w['end'] = min(w['end'], segments[i]['end'])
    return [
        s for s in segments
        if s['end'] > s['start'] and s.get('text', '').strip()
    ]


@app.route('/transcribe', methods=['POST', 'OPTIONS'])
def transcribe():
    if request.method == 'OPTIONS':
        return '', 200

    if not client:
        return jsonify({'error': 'Groq API key not found in server/config.json. Please add your key and restart.'}), 503

    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided. Send multipart form-data with key "audio".'}), 400

    audio_file = request.files['audio']
    language = request.form.get('language', None)
    audio_timing = request.form.get('timing') == 'audio'
    title = request.form.get('title') or os.path.splitext(audio_file.filename or '')[0]
    artist = request.form.get('artist') or ''
    try:
        duration = float(request.form.get('duration') or 0)
    except (ValueError, TypeError):
        duration = 0

    # ── Transcribe via Groq Cloud (whisper-large-v3) with acoustic word timestamps ──
    suffix = os.path.splitext(audio_file.filename or 'audio.mp3')[1] or '.mp3'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    compressed_path = None
    try:
        duration_seconds = audio_duration(tmp_path)
        if duration_seconds > MAX_DURATION_SECONDS:
            return jsonify({
                'error': f'Audio is {duration_seconds:.0f}s — exceeds the {MAX_DURATION_SECONDS}s (10 min) limit.',
                'duration': duration_seconds,
                'limit': MAX_DURATION_SECONDS,
            }), 413

        # Human-verified studio sync beats any ASR pass — try it first.
        if not audio_timing and title and title.strip():
            try:
                lrclib_data = fetch_synced_lyrics(title, artist, duration_seconds)
            except Exception as lrc_err:
                lrclib_data = None
                print(f'[LRCLIB] Lookup failed: {lrc_err}', flush=True)
            if lrclib_data and lrclib_data.get('segments'):
                cleaned_segs = clean_and_validate_segments(lrclib_data['segments'])
                if cleaned_segs:
                    total_words = sum(len(s.get('words', [])) for s in cleaned_segs)
                    print(f"[MistleTunes] Using LRCLIB studio lyrics for '{title}' ({len(cleaned_segs)} lines, {total_words} words)", flush=True)
                    return jsonify({
                        'source': 'lrclib-studio',
                        'timingVersion': TIMING_VERSION,
                        'alignment': 'studio-synced',
                        'language': lrclib_data.get('language') or 'auto',
                        'duration': round(duration_seconds, 2),
                        'segments': cleaned_segs,
                    })

        # Prepare file for Groq (compress if >24MB)
        file_to_send, was_compressed = compress_for_groq_if_needed(tmp_path)
        if was_compressed:
            compressed_path = file_to_send

        file_size_mb = os.path.getsize(file_to_send) / (1024 * 1024)
        print(f'[MistleTunes] Transcribing via Groq Cloud ({MODEL}) + karaoke-captions layout: {audio_file.filename} ({file_size_mb:.1f} MB)...', flush=True)

        with _inference_lock:
            with open(file_to_send, 'rb') as f:
                kwargs = {
                    'file': (audio_file.filename or f'audio{suffix}', f),
                    'model': MODEL,
                    'response_format': 'verbose_json',
                    'timestamp_granularities': ['word', 'segment'],
                }
                song_prompt = f"Lyrics for {title}" + (f" by {artist}" if artist else "")
                kwargs['prompt'] = song_prompt
                if language and language.strip():
                    kwargs['language'] = language.strip()
                response = client.audio.transcriptions.create(**kwargs)

        raw_words = getattr(response, 'words', []) or []
        raw_segments = getattr(response, 'segments', []) or []

        # Use karaoke-captions layout engine to group word timestamps into breath-aligned lines
        if raw_words:
            segments = build_karaoke_lines(raw_words, max_words=7, pause_break=0.5, sentence_break=True, line_hold=0.4)
        else:
            segments = []
            for s in raw_segments:
                seg = s if isinstance(s, dict) else (s.__dict__ if hasattr(s, '__dict__') else {})
                start = round(float(seg.get('start', 0)), 3)
                end = round(float(seg.get('end', 0)), 3)
                text = (seg.get('text') or '').strip()
                if end > start and text and text not in ('🎵', '🎶'):
                    segments.append({'start': start, 'end': end, 'text': text, 'words': []})
            segments = clean_and_validate_segments(segments)

        detected_lang = getattr(response, 'language', None) or language or 'unknown'
        total_words = sum(len(s.get('words', [])) for s in segments)
        print(f"[MistleTunes] Done. {len(segments)} karaoke lines, {total_words} words, language: {detected_lang}", flush=True)

        return jsonify({
            'source': 'groq-whisper-large-v3',
            'timingVersion': TIMING_VERSION,
            'alignment': 'karaoke-captions',
            'language': detected_lang,
            'duration': round(duration_seconds, 2),
            'segments': segments,
        })

    except Exception as error:
        print(f'[MistleTunes] Groq transcription error: {error}. Trying LRCLIB fallback...', flush=True)
        # Explicit audio re-sync must not silently return estimated word timings.
        if not audio_timing and title and title.strip():
            try:
                lrclib_data = fetch_synced_lyrics(title, artist, duration)
                if lrclib_data and lrclib_data.get('segments'):
                    cleaned_segs = clean_and_validate_segments(lrclib_data['segments'])
                    if cleaned_segs:
                        total_words = sum(len(s.get('words', [])) for s in cleaned_segs)
                        print(f"[MistleTunes] Using LRCLIB fallback lyrics for '{title}' ({len(cleaned_segs)} lines, {total_words} words)", flush=True)
                        return jsonify({
                            'source': 'lrclib-fallback',
                            'timingVersion': TIMING_VERSION,
                            'alignment': 'studio-synced',
                            'language': lrclib_data.get('language') or 'auto',
                            'duration': round(duration or lrclib_data.get('duration', 0), 2),
                            'segments': cleaned_segs,
                        })
            except Exception as lrc_err:
                print(f'[MistleTunes] LRCLIB search error: {lrc_err}', flush=True)

        traceback.print_exc()
        return jsonify({'error': str(error)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        if compressed_path:
            try:
                os.unlink(compressed_path)
            except OSError:
                pass


if __name__ == '__main__':
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    print('\n=======================================================')
    print('  MistleTunes Lyrics Server (Groq Cloud + karaoke-captions)')
    print(f'  Local:   http://localhost:5001')
    print(f'  Network: http://{local_ip}:5001')
    print('=======================================================\n')
    app.run(host='0.0.0.0', port=5001, debug=False)
