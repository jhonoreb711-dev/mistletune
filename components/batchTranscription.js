import { readGeneratedLyrics } from './generatedLyricsCache';
import { loadLyrics } from './lyricsStorage';
import { getOfflineLyricsStatus, transcribeOffline } from './offlineLyrics';

/** Prepare word-timed lyrics for imported tracks using bundled on-device Whisper. */
export async function batchTranscribeTracks(tracks, libraryId, onProgress = () => {}, cancelToken = null) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return { total: 0, processed: 0, skipped: 0, errors: 0 };
  }

  const total = tracks.length;
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let engineStatus;

  for (let i = 0; i < total; i++) {
    if (cancelToken?.cancelled) break;

    const track = tracks[i];
    const trackNum = i + 1;
    const title = track.title || track.name || `Song ${trackNum}`;

    try {
      const manual = await loadLyrics(libraryId, track.id);
      if (manual && !manual.generated) {
        skipped++;
        onProgress({ stage: 'transcribing', current: trackNum, total, track, progress: 1, message: `Lyrics already saved for "${title}" (${trackNum}/${total})` });
        continue;
      }
      const cached = await readGeneratedLyrics(track, libraryId);
      if (cached) {
        skipped++;
        onProgress({ stage: 'transcribing', current: trackNum, total, track, progress: 1, message: `Lyrics already ready for "${title}" (${trackNum}/${total})` });
        continue;
      }
    } catch { /* Continue and try local Whisper. */ }

    engineStatus ??= await getOfflineLyricsStatus();
    if (!engineStatus.ready) {
      onProgress({ stage: 'notice', message: engineStatus.message });
      return { total, processed, skipped: skipped + total - i, errors, unavailable: true, message: engineStatus.message };
    }
    onProgress({
      stage: 'transcribing', current: trackNum, total, track, progress: 0,
      message: `Generating offline lyrics for "${title}" (${trackNum}/${total})...`,
    });

    try {
      await transcribeOffline(track, {
        cancelToken,
        libraryId,
        onStage: () => onProgress({ stage: 'transcribing', current: trackNum, total, track, progress: 0.1, message: `Getting lyrics for "${title}" (${trackNum}/${total})...` }),
        onProgress: (progress) => onProgress({ stage: 'transcribing', current: trackNum, total, track, progress, message: `Getting lyrics for "${title}" (${Math.round(progress * 100)}%)` }),
      });
      processed++;
    } catch (error) {
      if (error?.code === 'CANCELLED' || cancelToken?.cancelled) break;
      if (error?.code === 'TOO_LONG') {
        skipped++;
        onProgress({ stage: 'transcribing', current: trackNum, total, track, progress: 1, message: `"${title}" was skipped (offline device size limit).` });
        continue;
      }
      // An unsupported build must not retry loading native code for every song.
      if (error?.code === 'OFFLINE_UNAVAILABLE') {
        skipped += (total - i);
        onProgress({ stage: 'notice', message: error.message });
        return { total, processed, skipped, errors, unavailable: true, message: error.message };
      }
      errors++;
      onProgress({ stage: 'transcribing', current: trackNum, total, track, progress: 1, message: `Could not prepare lyrics for "${title}": ${error?.message || error}` });
      console.warn(`Could not prepare lyrics for "${title}":`, error?.message || error);
    }
  }

  return { total, processed, skipped, errors };
}
