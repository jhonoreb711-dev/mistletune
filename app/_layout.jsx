import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { PlaybackProvider } from '../components/PlaybackContext';
import { FavoritesProvider } from '../components/FavoritesContext';
import MiniPlayerOverlay from '../components/MiniPlayerOverlay';
import ChatBot from '../components/ChatBot';
<<<<<<< HEAD
import QueueSheet from '../components/QueueSheet';
import { ThemeProvider } from '../themes/ThemeProvider';
import ThemeRestartRoute from '../themes/ThemeRestartRoute';
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705

// Hand off the native splash as soon as the animated emblem is displayed.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Layout() {
  const pathname = usePathname();
  const isIntro = pathname === '/';
  const isHome = pathname === '/Music';
  useFonts({
    NunitoRegular: Nunito_400Regular,
    NunitoMedium: Nunito_500Medium,
    NunitoSemiBold: Nunito_600SemiBold,
    NunitoBold: Nunito_700Bold,
    NunitoExtraBold: Nunito_800ExtraBold,
  });

  return (
<<<<<<< HEAD
    <ThemeProvider>
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
    <PlaybackProvider>
    <FavoritesProvider>
    <>
    <Stack screenOptions={{
        headerTransparent: true,
        headerTintColor: '#fff',
        headerShadowVisible: true
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="Music" options={{ headerShown: false }} />
      <Stack.Screen name="Artist" options={{ headerShown: false }} />
      <Stack.Screen name="Player" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="RecentlyPlayed" options={{ headerShown: false }} />
      <Stack.Screen name="Albums" options={{ headerShown: false }} />
      <Stack.Screen name="Search" options={{ headerShown: false }} />
      <Stack.Screen name="Library" options={{ headerShown: false }} />
<<<<<<< HEAD
      <Stack.Screen name="BenjiePlaylist" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="Settings" options={{ headerShown: false }} />
      <Stack.Screen name="podcast" options={{ headerShown: false }} />
      <Stack.Screen name="podcast-create" options={{ headerShown: false }} />
    </Stack>
    <ThemeRestartRoute />
    {!isIntro && <MiniPlayerOverlay />}
    {!isIntro && <QueueSheet />}
=======
      <Stack.Screen name="Settings" options={{ headerShown: false }} />
      <Stack.Screen name="podcast" options={{ headerShown: false }} />
    </Stack>
    {!isIntro && <MiniPlayerOverlay />}
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
    {isHome && <ChatBot />}
    </>
    </FavoritesProvider>
    </PlaybackProvider>
<<<<<<< HEAD
    </ThemeProvider>
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  );
}
