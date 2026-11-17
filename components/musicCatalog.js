import demoTrack from '../assets/demo-track.mp3';
import { themes } from '../themes';

export const tracks = [
  {
    id: 'winter-lights',
    title: 'SoundHelix Song 1',
    artist: 'T. Schürger',
    album: 'Demo Tracks',
    albumArtist: 'T. Schürger',
    durationSeconds: 373,
    kind: 'Music',
    duration: 'Demo track',
    source: demoTrack,
    artwork: null,
  },
];

export const artwork = { green: themes.christmas.assets.player, snowy: themes.christmas.assets.chat };
