import { useEffect } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { useTheme } from './ThemeProvider';

export default function ThemeRestartRoute() {
  const { restartAtIntro } = useTheme();
  const navigation = useRootNavigationState();
  useEffect(() => {
    if (restartAtIntro && navigation?.key) router.replace('/');
  }, [restartAtIntro, navigation?.key]);
  return null;
}
