import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayback } from './PlaybackContext';
import { getLegacyLibraryOwnerId } from './localLibraryIdentity';

const favoritesKey = (libraryId) => `music-player.favorites:${libraryId}`;
const LEGACY_FAVORITES_KEY = 'music-player.favorites';
const EMPTY_FAVORITES = { tracks: [], albums: [] };
const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { libraryId } = usePlayback();
  const favoritesRef = useRef(EMPTY_FAVORITES);
  const [savedFavorites, setSavedFavorites] = useState({ libraryId: null, data: EMPTY_FAVORITES });
  const favorites = savedFavorites.libraryId === libraryId ? savedFavorites.data : EMPTY_FAVORITES;

  useEffect(() => {
    let active = true;
    const key = libraryId ? favoritesKey(libraryId) : null;
    favoritesRef.current = EMPTY_FAVORITES;
    if (!key) return () => { active = false; };
    AsyncStorage.getItem(key)
      .then(async (serialized) => {
        if (!active) return;
        if (serialized === null && libraryId === await getLegacyLibraryOwnerId()) {
          return AsyncStorage.getItem(LEGACY_FAVORITES_KEY);
        }
        return serialized;
      })
      .then(async (serialized) => {
        if (!active || !serialized) return;
        const saved = JSON.parse(serialized);
        const normalized = {
          tracks: Array.isArray(saved.tracks) ? saved.tracks : [],
          albums: Array.isArray(saved.albums) ? saved.albums : [],
        };
        if (!(await AsyncStorage.getItem(key))) {
          await AsyncStorage.setItem(key, JSON.stringify(normalized));
          await AsyncStorage.removeItem(LEGACY_FAVORITES_KEY);
        }
        favoritesRef.current = normalized;
        setSavedFavorites({ libraryId, data: normalized });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [libraryId]);

  const toggleFavorite = useCallback(async (type, id) => {
    if (!libraryId) return null;
    const current = favoritesRef.current;
    const currentIds = current[type];
    const next = {
      ...current,
      [type]: currentIds.includes(id) ? currentIds.filter((savedId) => savedId !== id) : [...currentIds, id],
    };
    favoritesRef.current = next;
    setSavedFavorites({ libraryId, data: next });
    try {
      await AsyncStorage.setItem(favoritesKey(libraryId), JSON.stringify(next));
      return next[type].includes(id);
    } catch {
      favoritesRef.current = current;
      setSavedFavorites({ libraryId, data: current });
      return null;
    }
  }, [libraryId]);

  const value = useMemo(() => ({
    favoriteTrackIds: favorites.tracks,
    favoriteAlbumIds: favorites.albums,
    isTrackFavorite: (id) => favorites.tracks.includes(id),
    isAlbumFavorite: (id) => favorites.albums.includes(id),
    toggleTrackFavorite: (id) => toggleFavorite('tracks', id),
    toggleAlbumFavorite: (id) => toggleFavorite('albums', id),
  }), [favorites, toggleFavorite]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used inside FavoritesProvider');
  return context;
}
