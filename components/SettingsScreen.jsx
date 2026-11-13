import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image, ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayback } from './PlaybackContext';
import { getPodcastVideos, savePodcastVideos, pickPodcastCover } from './podcastVideoStorage';
import {
  pickAndSavePodcastVideos,
  pickAndReplacePodcastVideo,
  deleteVideoFile,
} from './videoFileService';

import settingsBackground from '../assets/Steampunk_Christmas_Music_Workshop.gif';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [statusMessage, setStatusMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isChoosingVideo, setIsChoosingVideo] = useState(false);
  const [podcastVideos, setPodcastVideos] = useState([]);
  const [isChoosingPodcastVideos, setIsChoosingPodcastVideos] = useState(false);
  const scanInProgress = useRef(false);
  const {
    tracks,
    homeVideoName,
    changeHomeVideo,
    resetHomeVideo,
    musicFolderName,
    chooseMusicFolder,
    addAudioFiles,
  } = usePlayback();

  useEffect(() => {
    getPodcastVideos().then(setPodcastVideos);
  }, []);

  const choosePodcastVideos = async (existingVideo = null) => {
    if (isChoosingPodcastVideos) return;
    setIsChoosingPodcastVideos(true);
    setStatusMessage('Opening video picker...');
    try {
      if (existingVideo) {
        const replaced = await pickAndReplacePodcastVideo(existingVideo);
        if (!replaced) {
          setStatusMessage('No replacement video selected.');
          return;
        }
        const updatedVideos = podcastVideos.map((v) => (v.id === existingVideo.id ? replaced : v));
        await savePodcastVideos(updatedVideos);
        setPodcastVideos(updatedVideos);
        setStatusMessage(`Updated podcast video: ${replaced.name}`);
      } else {
        const newVideos = await pickAndSavePodcastVideos(true);
        if (!newVideos || !newVideos.length) {
          setStatusMessage('No podcast videos selected.');
          return;
        }
        const updatedVideos = [...podcastVideos, ...newVideos];
        await savePodcastVideos(updatedVideos);
        setPodcastVideos(updatedVideos);
        setStatusMessage(`Added ${newVideos.length} podcast ${newVideos.length === 1 ? 'video' : 'videos'}.`);
      }
    } catch (error) {
      setStatusMessage(error.message || 'Could not update podcast videos.');
    } finally {
      setIsChoosingPodcastVideos(false);
    }
  };

  const removePodcastVideo = (video) => {
    Alert.alert(
      'Remove Video',
      `Are you sure you want to delete "${video.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedVideos = podcastVideos.filter((item) => item.id !== video.id);
            try {
              await savePodcastVideos(updatedVideos);
              setPodcastVideos(updatedVideos);
              await deleteVideoFile(video.uri);
              if (video.coverUri) await deleteVideoFile(video.coverUri);
              setStatusMessage(`Removed podcast video: ${video.name}`);
            } catch (error) {
              setStatusMessage(error.message || 'Could not remove that podcast video.');
            }
          },
        },
      ]
    );
  };

  const changePodcastCover = async (video) => {
    if (isChoosingPodcastVideos) return;
    setIsChoosingPodcastVideos(true);
    try {
      const updated = await pickPodcastCover(video.id);
      if (updated) {
        setPodcastVideos(updated);
        setStatusMessage(`Cover updated for ${video.title || video.name}`);
      }
    } catch (error) {
      setStatusMessage(error.message || 'Could not save the podcast cover.');
    } finally {
      setIsChoosingPodcastVideos(false);
    }
  };

  const handleChooseHomeVideo = async () => {
    if (isChoosingVideo) return;
    setIsChoosingVideo(true);
    setStatusMessage('Opening video picker...');
    try {
      const saved = await changeHomeVideo();
      if (!saved) {
        setStatusMessage('No home video selected.');
        return;
      }
      setStatusMessage(`Home video saved: ${saved.name}`);
    } catch (error) {
      setStatusMessage(error.message || 'Could not change the home video.');
    } finally {
      setIsChoosingVideo(false);
    }
  };

  const handleResetHomeVideo = async () => {
    try {
      await resetHomeVideo();
      setStatusMessage('Default home video restored.');
    } catch (error) {
      setStatusMessage(error.message || 'Could not restore the default home video.');
    }
  };

  const pickMusicFolder = async () => {
    if (scanInProgress.current) return;
    scanInProgress.current = true;
    setIsScanning(true);
    setStatusMessage('Choose a folder and tap Use this folder. Your songs will sync automatically.');
    try {
      const { folderName, trackCount } = await chooseMusicFolder();
      setStatusMessage(folderName + ': ' + trackCount + (trackCount === 1 ? ' track synced.' : ' tracks synced.'));
    } catch (error) {
      setStatusMessage(error.message || 'Could not sync the selected music folder.');
    } finally {
      scanInProgress.current = false;
      setIsScanning(false);
    }
  };

  const addMusicFiles = async () => {
    if (scanInProgress.current) return;
    scanInProgress.current = true;
    setIsScanning(true);
    try {
      const count = await addAudioFiles();
      setStatusMessage(count + (count === 1 ? ' track in your library.' : ' tracks in your library.'));
    } catch (error) {
      setStatusMessage(error.message || 'Could not add audio files.');
    } finally {
      scanInProgress.current = false;
      setIsScanning(false);
    }
  };

  return (
    <ImageBackground source={settingsBackground} contentFit="cover" autoplay style={styles.background}>
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>
        <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to your library"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={25} color={COLORS.cream} />
            </Pressable>
            <Text style={styles.heading}>Settings</Text>
            <View style={styles.headerGear}><Ionicons name="settings" size={23} color={COLORS.gold} /></View>
          </View>

          <Text style={styles.intro}>Manage your music library.</Text>
          <View style={styles.ornamentDivider}>
            <View style={styles.ornamentLine} />
            <Text style={styles.ornamentText}>✦  ♫  ✦</Text>
            <View style={styles.ornamentLine} />
          </View>
          {statusMessage ? (
            <View accessibilityRole="text" style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.settingsScroll}
          contentContainerStyle={[styles.settingsScrollContent, { paddingBottom: Math.max(insets.bottom, 8) + 76 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionBannerWrap}>
            <View style={styles.sectionBannerIcon}><Ionicons name="musical-notes" size={22} color={COLORS.gold} /></View>
            <Text style={styles.sectionBannerText}>Music library</Text>
            <Ionicons name="snow" size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
          </View>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{Platform.OS === 'android' ? 'Music folder' : 'Add music'}</Text>
            <Text style={styles.helperText}>
              {Platform.OS === 'android'
                ? musicFolderName ? `Folder: ${musicFolderName}` : 'Choose the folder where your songs are saved.'
                : 'Choose audio files from your phone, then they will be added to your library.'}
            </Text>
            <Text style={styles.helperText}>
              {Platform.OS === 'android'
                ? musicFolderName
                  ? 'Choose this folder again to sync any newly added songs automatically.'
                  : 'Tap Use this folder and allow access. Songs sync automatically.'
                : 'Supported formats: MP3, M4A, WAV, AAC, OGG, and FLAC.'}
            </Text>
            <Text style={styles.helperText}>Songs are copied into the app. Album tags group them into albums.</Text>
            {Platform.OS === 'android' ? (
              <Pressable
                accessibilityRole="button"
              disabled={isScanning}
                onPress={pickMusicFolder}
                style={({ pressed }) => [styles.secondaryButton, styles.folderButton, pressed && styles.pressed]}
              >
                <Ionicons name="folder-open-outline" size={19} color={COLORS.cream} />
                <Text style={styles.secondaryButtonText}>{isScanning ? 'Selecting / syncing music...' : musicFolderName ? 'Choose / sync music folder' : 'Choose music folder'}</Text>
              </Pressable>
            ) : null}
            {Platform.OS !== 'android' ? <Pressable
              accessibilityRole="button"
              disabled={isScanning}
              onPress={addMusicFiles}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Ionicons name={isScanning ? 'hourglass-outline' : 'refresh-outline'} size={19} color={COLORS.cream} />
              <Text style={styles.secondaryButtonText}>{isScanning ? 'Adding music...' : 'Add audio files'}</Text>
            </Pressable> : null}
            <Text style={styles.helperText}>{tracks.length} playable {tracks.length === 1 ? 'track' : 'tracks'} in your library.</Text>
          </View>

          {Platform.OS !== 'web' ? (
            <>
              <View style={styles.sectionBannerWrap}>
                <View style={styles.sectionBannerIcon}><Ionicons name="videocam" size={22} color={COLORS.gold} /></View>
                <Text style={styles.sectionBannerText}>Home screen video</Text>
                <Ionicons name="snow" size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
              </View>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Current video</Text>
                <Text style={styles.helperText} numberOfLines={1}>{homeVideoName}</Text>
                <Text style={styles.helperText}>Choose a video from your device. It will play on Home when no song is playing.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isChoosingVideo}
                  onPress={handleChooseHomeVideo}
                  style={({ pressed }) => [styles.secondaryButton, styles.folderButton, pressed && styles.pressed]}
                >
                  <Ionicons name="videocam-outline" size={19} color={COLORS.cream} />
                  <Text style={styles.secondaryButtonText}>{isChoosingVideo ? 'Opening videos...' : 'Choose home video'}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleResetHomeVideo}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Ionicons name="refresh-outline" size={19} color={COLORS.cream} />
                  <Text style={styles.secondaryButtonText}>Restore default video</Text>
                </Pressable>
              </View>

              <View style={styles.sectionBannerWrap}>
                <View style={styles.sectionBannerIcon}><Ionicons name="film" size={22} color={COLORS.gold} /></View>
                <Text style={styles.sectionBannerText}>Podcast videos</Text>
                <Ionicons name="snow" size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
              </View>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Your podcast collection</Text>
                <Text style={styles.helperText}>Add videos here. They will appear in the Podcast list.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isChoosingPodcastVideos}
                  onPress={() => choosePodcastVideos()}
                  style={({ pressed }) => [styles.secondaryButton, styles.folderButton, pressed && styles.pressed, isChoosingPodcastVideos && styles.disabled]}
                >
                  <Ionicons name="add-circle-outline" size={19} color={COLORS.cream} />
                  <Text style={styles.secondaryButtonText}>{isChoosingPodcastVideos ? 'Opening videos...' : 'Add podcast videos'}</Text>
                </Pressable>
                {podcastVideos.length ? (
                  <View style={styles.podcastVideoList}>
                    {podcastVideos.map((video) => (
                      <View key={video.id} style={styles.podcastVideoRow}>
                        <View style={[styles.podcastVideoIcon, { overflow: 'hidden' }]}>{video.coverUri ? <Image source={{ uri: video.coverUri }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="videocam" size={18} color={COLORS.gold} />}</View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={styles.podcastVideoName}>{video.title || video.name}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Edit cover for ${video.title || video.name}`} disabled={isChoosingPodcastVideos} onPress={() => changePodcastCover(video)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
                            <Ionicons name="image-outline" size={14} color={COLORS.green} />
                            <Text style={{ color: COLORS.green, fontFamily: 'NunitoBold', fontSize: 12 }}>{video.coverUri ? 'Change cover' : 'Add cover'}</Text>
                          </Pressable>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Replace ${video.name}`}
                          disabled={isChoosingPodcastVideos}
                          onPress={() => choosePodcastVideos(video)}
                          style={styles.podcastVideoAction}
                        >
                          <Ionicons name="create-outline" size={19} color={COLORS.green} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${video.name}`}
                          onPress={() => removePodcastVideo(video)}
                          style={styles.podcastVideoAction}
                        >
                          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.helperText}>No podcast videos added yet.</Text>
                )}
              </View>
            </>
          ) : null}

        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {[
            { label: 'Home', icon: 'home' },
            { label: 'Search', icon: 'search' },
            { label: 'Your Library', icon: 'library' },
            { label: 'Settings', icon: 'settings' },
          ].map((tab) => {
            const selected = tab.label === 'Settings';
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (tab.label === 'Home') router.replace('/Music');
                  if (tab.label === 'Search') router.replace('/Search');
                  if (tab.label === 'Your Library') router.replace('/Library');
                  if (tab.label === 'Settings') router.replace('/Settings');
                }}
                style={styles.navItem}
              >
                <Ionicons
                  name={selected ? tab.icon : `${tab.icon}-outline`}
                  size={21}
                  color={selected ? COLORS.red : COLORS.ink}
                />
                <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

      </View>
    </ImageBackground>
  );
}

const COLORS = {
  green: '#07502c',
  red: '#a20d1b',
  gold: '#f2bb4f',
  ink: '#24180d',
  muted: '#624a2e',
  cream: '#fff0c9',
  line: '#b88232',
};

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20 },
  settingsScroll: { flex: 1, marginHorizontal: 20, overflow: 'hidden' },
  settingsScrollContent: { paddingBottom: 84 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 8, backgroundColor: COLORS.cream, borderTopWidth: 2, borderTopColor: COLORS.gold },
  navItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1 },
  navLabel: { color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 10 },
  navLabelSelected: { color: COLORS.red, fontFamily: 'NunitoExtraBold' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, marginTop: 24 },
  backButton: { width: 34, height: 36, justifyContent: 'center', marginRight: 4 },
  heading: { flex: 1, color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 28, textShadowColor: COLORS.gold, textShadowRadius: 7 },
  headerGear: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: 'rgba(0,34,18,0.8)', borderWidth: 2, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOpacity: 0.65, shadowRadius: 7, elevation: 3 },
  intro: { color: COLORS.cream, fontFamily: 'NunitoSemiBold', fontSize: 14, textAlign: 'center', marginBottom: 5, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 4 },
  ornamentDivider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  ornamentLine: { flex: 1, height: 1.5, backgroundColor: COLORS.gold },
  ornamentText: { color: COLORS.gold, fontFamily: 'NunitoExtraBold', fontSize: 16, textShadowColor: COLORS.gold, textShadowRadius: 6 },
  sectionBannerWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 13, marginTop: 2, marginBottom: -17, zIndex: 2 },
  sectionBannerIcon: { position: 'absolute', left: 0, zIndex: 1, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: COLORS.red, shadowColor: COLORS.gold, shadowOpacity: 0.6, shadowRadius: 7, elevation: 4 },
  sectionBannerText: { flex: 1, color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 17, textAlign: 'center', paddingHorizontal: 50, paddingVertical: 10, borderRadius: 24, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: COLORS.red, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  sectionBannerFlourish: { position: 'absolute', right: 10, color: COLORS.gold, fontSize: 17, textShadowColor: COLORS.gold, textShadowRadius: 6 },
  card: { paddingHorizontal: 17, paddingTop: 29, paddingBottom: 17, borderRadius: 23, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: COLORS.cream, shadowColor: COLORS.gold, shadowOpacity: 0.42, shadowRadius: 9, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  fieldLabel: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 14, marginBottom: 4 },
  input: { minHeight: 38, paddingVertical: 5, color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.line, marginVertical: 7 },
  helperText: { color: COLORS.ink, fontFamily: 'NunitoRegular', fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 8 },
  disabled: { opacity: 0.6 },
  podcastVideoList: { gap: 7, marginTop: 2 },
  podcastVideoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(7,80,44,0.08)' },
  podcastVideoIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.green },
  podcastVideoName: { flex: 1, minWidth: 0, color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 12 },
  podcastVideoAction: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 2, borderColor: COLORS.gold, borderRadius: 24, backgroundColor: COLORS.green, shadowColor: COLORS.gold, shadowOpacity: 0.32, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  folderButton: { marginBottom: 10 },
  secondaryButtonText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  statusBox: { marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.gold, backgroundColor: COLORS.cream },
  statusText: { color: COLORS.green, fontFamily: 'NunitoSemiBold', fontSize: 12 },
  pressed: { opacity: 0.82 },
});
