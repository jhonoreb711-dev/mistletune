import { ImageBackground } from 'expo-image';
import { useTheme } from '../themes/ThemeProvider';

/** Keeps plain Default pages filled by the selected color when artwork is disabled. */
export default function ThemeImageBackground({ source, style, ...props }) {
  const { theme } = useTheme();
  return (
    <ImageBackground
      {...props}
      source={theme.id === 'default' ? null : source}
      style={[style, theme.id === 'default' && { backgroundColor: theme.colors.primary }]}
    />
  );
}
