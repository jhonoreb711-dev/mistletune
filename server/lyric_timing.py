"""Preserve recording-relative word timestamps, including leading silence."""

import math


def merge_words_into_segments(segments, words):
    normalized = []
    for item in words:
        word = item if isinstance(item, dict) else vars(item)
        start = float(word.get('start', 0))
        end = float(word.get('end', 0))
        text = (word.get('word') or '').strip()
        if text and math.isfinite(start) and math.isfinite(end) and 0 <= start < end:
            normalized.append({'word': text, 'start': start, 'end': end})
    normalized.sort(key=lambda word: word['start'])
    # Resolve overlapping model intervals without shifting any word onset.
    for current, following in zip(normalized, normalized[1:]):
        current['end'] = min(current['end'], following['start'])
    normalized = [word for word in normalized if word['end'] > word['start']]
    if not normalized:
        return segments

    lines = []
    previous_group = None
    for word in normalized:
        midpoint = (word['start'] + word['end']) / 2
        group = min(range(len(segments)), key=lambda index: max(
            segments[index]['start'] - midpoint, midpoint - segments[index]['end'], 0
        )) if segments else 0
        if (not lines or group != previous_group or len(lines[-1]['words']) >= 12
                or word['start'] - lines[-1]['end'] > 1):
            lines.append({'start': word['start'], 'end': word['end'], 'text': '', 'words': []})
        line = lines[-1]
        line['words'].append(word)
        line['end'] = word['end']
        line['text'] = ' '.join(item['word'] for item in line['words'])
        previous_group = group
    return lines
