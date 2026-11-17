"""
lrclib.py
Searches the open-source LRCLIB database (https://lrclib.net) for official,
human-verified, millisecond-synced lyrics (.lrc).

Converts synced lyrics into exact segment and word timestamps with 0-delay precision.
"""

import re
import json
import urllib.request
import urllib.parse

USER_AGENT = "MistleTunes/1.0 (https://github.com/benchtadeo30/mistletune)"


def _syncedlyrics_search(query):
    """Try the syncedlyrics package across all providers. Returns LRC text
    (line-level, or karaoke word-level when available) or None."""
    try:
        import logging
        import syncedlyrics
        logging.getLogger('syncedlyrics').setLevel(logging.CRITICAL)
        text = syncedlyrics.search(query, enhanced=True)
        return text if isinstance(text, str) and text.strip() else None
    except Exception:
        return None


def _lrc_duration_ok(segments, duration):
    """Reject wrong-version matches: the last lyric line should sit inside the song."""
    if not segments:
        return False
    if not duration or float(duration) <= 0:
        return True
    end = segments[-1]['end']
    wanted = float(duration)
    return end >= wanted * 0.35 and end <= wanted + 30


def _from_lrc_text(text, duration, source):
    segments = parse_lrc_to_segments(text, duration)
    if segments and _lrc_duration_ok(segments, duration):
        return {
            "source": source,
            "language": "auto",
            "duration": duration,
            "segments": segments,
        }
    return None


def clean_title(title):
    """
    Strips noise like (Official Audio), [Lyric Video], (Remastered 2021), file extensions.
    """
    if not title:
        return ""
    # Strip (Official Video), [Lyrics], etc.
    t = re.sub(r'[\(\[\{][^\)\]\}]*(?:official|audio|video|lyric|remaster|hd|4k|hq|visualizer|feat|ft\.)[^\)\]\}]*[\)\]\}]', '', title, flags=re.IGNORECASE)
    # Strip remaining trailing brackets if empty
    t = re.sub(r'[\(\[\{]\s*[\)\]\}]', '', t)
    # Strip file extension
    t = re.sub(r'\.(mp3|m4a|wav|flac|aac|ogg)$', '', t, flags=re.IGNORECASE)
    # Strip trailing dashes or whitespace
    t = re.sub(r'\s+-\s*$', '', t)
    return t.strip()


def parse_lrc_to_segments(lrc_text, total_duration=0):
    """
    Parses synchronized LRC into segments with word timestamps.
    Handles standard [mm:ss.xx] tags and Enhanced LRC <mm:ss.xx> word tags.
    """
    if not lrc_text:
        return []

    lines_raw = lrc_text.splitlines()
    timed_lines = []

    for line in lines_raw:
        line = line.strip()
        if not line:
            continue

        # Check for [mm:ss.xx] line timestamp
        match = re.match(r'^\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\](.*)', line)
        if not match:
            continue

        mins, secs, frac, text = match.groups()
        frac_str = (frac or '0')[:3].ljust(3, '0')
        start_time = int(mins) * 60 + int(secs) + int(frac_str) / 1000.0

        clean_content = text.strip()
        if not clean_content:
            continue

        timed_lines.append((start_time, clean_content))

    if not timed_lines:
        return []

    timed_lines.sort(key=lambda x: x[0])
    segments = []

    for i, (start_time, content) in enumerate(timed_lines):
        if i + 1 < len(timed_lines):
            end_time = timed_lines[i + 1][0]
        else:
            end_time = max(start_time + 3.0, total_duration if total_duration > start_time else start_time + 3.0)

        # Ensure valid range
        if end_time <= start_time:
            end_time = start_time + 2.0

        # Check if line has Enhanced LRC word tags: <mm:ss.xx>word
        word_tags = list(re.finditer(r'<(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?>\s*([^<]+)', content))

        words = []
        if word_tags:
            for w_idx, wt in enumerate(word_tags):
                wmins, wsecs, wfrac, wword = wt.groups()
                wfrac_str = (wfrac or '0')[:3].ljust(3, '0')
                w_start = int(wmins) * 60 + int(wsecs) + int(wfrac_str) / 1000.0
                if w_idx + 1 < len(word_tags):
                    n_mins, n_secs, n_frac, _ = word_tags[w_idx + 1].groups()
                    n_frac_str = (n_frac or '0')[:3].ljust(3, '0')
                    w_end = int(n_mins) * 60 + int(n_secs) + int(n_frac_str) / 1000.0
                else:
                    w_end = end_time
                words.append({
                    'word': wword.strip(),
                    'start': round(w_start, 3),
                    'end': round(max(w_start + 0.1, w_end), 3),
                })
            display_text = re.sub(r'<[^>]+>', '', content).strip()
        else:
            # Standard line: distribute words smoothly across the line duration
            # weighted by character length (longer words = longer duration)
            clean_words = content.split()
            if clean_words:
                total_chars = sum(len(w) for w in clean_words) or 1
                line_duration = end_time - start_time
                cur_t = start_time

                for w in clean_words:
                    w_duration = line_duration * (len(w) / total_chars)
                    w_end = round(cur_t + w_duration, 3)
                    words.append({
                        'word': w,
                        'start': round(cur_t, 3),
                        'end': w_end,
                    })
                    cur_t = w_end
            display_text = content

        segments.append({
            'start': round(start_time, 3),
            'end': round(end_time, 3),
            'text': display_text,
            'words': words,
        })

    return segments


def _norm(text):
    return re.sub(r'[^a-z0-9]+', '', (text or '').lower())


def score_candidate(item, cleaned_title, artist, duration):
    """
    Rank an LRCLIB search hit against the requested song. A wrong-version or
    cover-version match produces completely wrong "studio synced" lyrics, which
    is worse than no match at all, so unverifiable candidates are rejected.
    """
    track = _norm(item.get('trackName'))
    title = _norm(cleaned_title)
    if not track or not title:
        return None
    if track == title:
        score = 60
    elif title in track or track in title:
        score = 35
    else:
        return None
    if artist and artist.strip() and artist.lower() != 'unknown artist':
        wanted_artist = _norm(artist)
        found_artist = _norm(item.get('artistName'))
        if wanted_artist and found_artist:
            if wanted_artist == found_artist:
                score += 30
            elif wanted_artist in found_artist or found_artist in wanted_artist:
                score += 15
            else:
                return None
    try:
        cand_duration = float(item.get('duration') or 0)
        wanted = float(duration or 0)
        if wanted > 0 and cand_duration > 0:
            diff = abs(cand_duration - wanted)
            if diff <= 3:
                score += 20
            elif diff <= 10:
                score += 10
            elif diff > 45:
                return None
            else:
                score -= 10
    except (TypeError, ValueError):
        pass
    if item.get('syncedLyrics'):
        score += 10
    return score


def fetch_synced_lyrics(title, artist="", duration=0):
    """
    Queries LRCLIB for official synced lyrics.
    Returns parsed segments list or None.
    """
    cleaned_title = clean_title(title)
    if not cleaned_title:
        return None

    queries = []
    if artist and artist.strip() and artist.lower() != "unknown artist":
        queries.append(f"{cleaned_title} {artist.strip()}")
    queries.append(cleaned_title)

    # 1) syncedlyrics package across all providers (Musixmatch/NetEase/LRCLIB/...).
    for q in queries:
        result = _from_lrc_text(_syncedlyrics_search(q) or "", duration, "syncedlyrics")
        if result:
            print(f"[syncedlyrics] Matched '{q}' ({len(result['segments'])} lines)")
            return result

    # 2) Direct LRCLIB search with candidate scoring (backup).
    best = None  # (score, item)
    for q in queries:
        try:
            url = "https://lrclib.net/api/search?" + urllib.parse.urlencode({"q": q})
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if not isinstance(data, list):
                    continue
                for item in data:
                    if not (item.get("syncedLyrics") or "").strip():
                        continue
                    score = score_candidate(item, cleaned_title, artist, duration)
                    if score is None:
                        continue
                    if best is None or score > best[0]:
                        best = (score, item)
        except Exception as err:
            print(f"[LRCLIB] Query '{q}' error: {err}")

    # Require a plausible title (and artist, when supplied) match before trusting it.
    if best and best[0] >= 40:
        item = best[1]
        segments = parse_lrc_to_segments(item["syncedLyrics"], duration)
        if segments:
            track_name = item.get("trackName") or cleaned_title
            artist_name = item.get("artistName") or ""
            print(f"[LRCLIB] Matched: {artist_name} - {track_name} ({len(segments)} lines, score {best[0]}) [0ms lag]")
            return {
                "source": "lrclib",
                "language": "auto",
                "duration": duration or item.get("duration", 0),
                "segments": segments,
            }
    return None
