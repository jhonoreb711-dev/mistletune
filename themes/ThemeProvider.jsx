import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_THEME_ID, isThemeId, themes, THEME_STORAGE_KEY } from './index';

/** @typedef {keyof typeof themes} ThemeId */
/** @typedef {{ theme: typeof themes[ThemeId], selectTheme: (id: ThemeId) => Promise<void> }} ThemeContextValue */
const ThemeContext = createContext(/** @type {ThemeContextValue | null} */ (null));

/** @param {{ children: import('react').ReactNode }} props */
export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(/** @type {ThemeId} */ (DEFAULT_THEME_ID));
  const [defaultColor, setDefaultColor] = useState('#182230');
  const [restartAtIntro, setRestartAtIntro] = useState(false);
  const [ready, setReady] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(async (stored) => {
        if (!active || !stored) return;
        let saved;
        try { saved = JSON.parse(stored); } catch { saved = { id: stored }; }
        if (isThemeId(saved?.id)) {
          setThemeId(saved.id);
          if (saved.id === 'default' && /^#[\da-f]{6}$/i.test(saved.color || '')) setDefaultColor(saved.color.toUpperCase());
          if (saved.restartAtIntro === true) {
            setRestartAtIntro(true);
            await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ id: saved.id, color: saved.color }));
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const selectTheme = useCallback(/** @param {ThemeId} id @param {string} [color] */ async (id, color) => {
    if (!isThemeId(id)) throw new Error('Choose an available theme.');
    if (saving.current) throw new Error('Please wait for your theme to finish saving.');
    saving.current = true;
    try {
      const nextColor = id === 'default' && /^#[\da-f]{6}$/i.test(color || '') ? color.toUpperCase() : defaultColor;
      await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ id, color: nextColor, restartAtIntro: true }));
      setThemeId(id);
      if (id === 'default') setDefaultColor(nextColor);
    } finally {
      saving.current = false;
    }
  }, [defaultColor]);

  const theme = useMemo(() => themeId === 'default' ? {
    ...themes.default,
    colors: (() => {
      const channels = [1, 3, 5].map((index) => parseInt(defaultColor.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      const foreground = luminance > 0.42 ? '#171717' : '#FFFFFF';
      const mix = (other, amount) => '#' + [1, 3, 5].map((index) => {
        const baseChannel = parseInt(defaultColor.slice(index, index + 2), 16);
        const otherChannel = parseInt(other.slice(index, index + 2), 16);
        return Math.round(baseChannel + (otherChannel - baseChannel) * amount).toString(16).padStart(2, '0');
      }).join('').toUpperCase();
      return {
        ...themes.default.colors,
        primary: defaultColor, intro: defaultColor,
        accent: foreground, gold: foreground, ink: foreground, muted: foreground, cream: foreground,
        line: mix(foreground, 0.38), surface: mix(foreground, 0.12),
        surfaceDeep: mix(foreground, 0.06), surfaceRaised: mix(foreground, 0.18),
        surfaceTint: mix(foreground, 0.14), surfaceBorder: mix(foreground, 0.42),
        onSurfaceMuted: foreground, tint: 'transparent', progress: foreground,
      };
    })(),
    assets: { ...themes.default.assets, home: null, search: null, library: null, settings: null, collection: null, player: null, chat: null, loadingBackground: null, homeVideoImage: null },
  } : themes[themeId], [themeId, defaultColor]);
  const value = useMemo(() => ({ theme, selectTheme, restartAtIntro }), [theme, selectTheme, restartAtIntro]);
  // Resolve the saved theme before mounting the intro or creating media players.
  if (!ready) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}

// Christmas keeps its base palette; every other theme maps its semantic colors
// to the shared screens without recreating styles on every render.
/**
 * @template T
 * @param {(colors: Record<string, string>, searchColors: Record<string, string>) => T} createStyles
 * @param {Record<string, string>} defaultColors
 * @param {Record<string, string>} [defaultSearchColors]
 */
export function useThemeStyles(createStyles, defaultColors, defaultSearchColors) {
  const { theme } = useTheme();
  return useMemo(() => {
    /** @type {Record<string, string>} */
    const overrides = theme.id === 'christmas' ? {} : {
      green: theme.colors.primary,
      red: theme.id === 'default' ? theme.colors.surfaceRaised : theme.colors.accent,
      gold: theme.colors.gold,
      goldMuted: theme.colors.gold,
      goldBorder: theme.colors.line,
      cream: theme.colors.cream,
      line: theme.colors.line,
      greenDeep: theme.colors.surfaceDeep,
      greenDark: theme.colors.surface,
      greenPanel: theme.colors.surfaceRaised,
      greenPanelAlt: theme.colors.surfaceRaised,
      moss: theme.colors.onSurfaceMuted,
      ember: theme.colors.gold,
    };
    // Opaque surfaces keep text readable over each theme's animated artwork.
    const surfaces = {
      surface: theme.colors.surface,
      surfaceDeep: theme.colors.surfaceDeep,
      surfaceRaised: theme.colors.surfaceRaised,
      surfaceTint: theme.colors.surfaceTint,
      surfaceBorder: theme.colors.surfaceBorder,
      onSurfaceMuted: theme.colors.onSurfaceMuted,
      chatIcon: theme.colors.chatIcon,
      userBubble: theme.colors.userBubble,
      tint: theme.colors.tint,
      progress: theme.colors.progress,
      darkGreen: theme.colors.surfaceDeep,
      aiHue: theme.colors.surface,
    };
    const colors = { ...defaultColors, ...overrides, ...surfaces };
    const searchColors = { ...defaultSearchColors, ...overrides };
    const styles = createStyles(colors, searchColors);
    return { colors, searchColors, styles: theme.id === 'default' ? adaptDefaultStyles(styles, theme.colors) : styles };
  }, [theme, createStyles, defaultColors, defaultSearchColors]);
}

// Older screens contain literal seasonal colors in their StyleSheets. In the
// plain theme, translate those legacy values to the current adaptive palette so
// a custom light or dark background keeps every page readable.
function adaptDefaultStyles(styles, colors) {
  const adapted = {};
  for (const [name, style] of Object.entries(styles)) {
    if (!style || typeof style !== 'object' || Array.isArray(style)) {
      adapted[name] = style;
      continue;
    }
    const next = { ...style };
    for (const [key, value] of Object.entries(next)) {
      if (typeof value !== 'string') continue;
      if (key === 'color' || key === 'placeholderTextColor' || key === 'selectionColor') {
        next[key] = key === 'placeholderTextColor' ? colors.onSurfaceMuted : colors.cream;
      } else if (/^border.*Color$/.test(key)) {
        next[key] = colors.surfaceBorder;
      } else if (key === 'backgroundColor' && !isTransparentColor(value)) {
        const normalized = value.toUpperCase();
        const semanticSurfaces = [colors.primary, colors.surface, colors.surfaceDeep, colors.surfaceRaised, colors.surfaceTint];
        if (!semanticSurfaces.some((surface) => surface.toUpperCase() === normalized)) next[key] = colors.surfaceRaised;
      }
    }
    adapted[name] = next;
  }
  return adapted;
}

function isTransparentColor(color) {
  return color === 'transparent' || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(color);
}
