# Seasonal themes

Settings → Configure theme opens the theme picker. Applying a theme updates the
mounted screens immediately and saves the choice in AsyncStorage. Startup waits
for that choice before displaying the welcome animation.

`index.js` owns the artwork assignments and seasonal colors. Keep artwork in
`Christmas/` or `Halloween/`, and use `useTheme()` in screens instead of importing
seasonal files directly. Metro needs literal `require()` paths in the registry.

| Asset role | Used by |
| --- | --- |
| `home`, `mascot` | Home background and Benjie above the video |
| `homeVideo` | Default home video; user-selected videos take precedence |
| `search`, `library`, `settings` | Corresponding page backgrounds |
| `collection` | Albums, artists, recently played, and podcasts |
| `player`, `chat` | Player and chat backgrounds |
| `emblem` | First welcome screen |
| `loadingBackground`, `loadingCharacter` | Loading screen and progress mascot |

Halloween uses every supplied asset: its costume for the home mascot,
the broom dog for loading, five GIF backgrounds, and the Halloween video.
The broom PNG moves along the loading bar; it is not an animated GIF.
Both themes keep the original animated GIF logo on the first welcome screen.
Halloween uses a purple welcome background; Christmas keeps green and its running dog.
The older unused `intro.gif` and `reg_bg.gif` are retained in `Christmas/`.
Shared app icons and the CD artwork remain in `assets/`.

The operating-system launch splash is build-time configuration in `app.json`;
the saved theme applies to the subsequent in-app welcome and loading screens.

Validation:

```sh
npx expo lint
npx tsc --noEmit -p themes/tsconfig.json
node --test tests/themes.test.mjs
```
