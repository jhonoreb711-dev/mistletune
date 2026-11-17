import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import test from 'node:test';

// Metro resolves these requires to asset IDs. Use paths for Node validation.
const registryUrl = new URL('../themes/index.js', import.meta.url);
const source = (await readFile(registryUrl, 'utf8')).replace(/require\('([^']+)'\)/g, (_, path) => JSON.stringify(path));
const { themes, isThemeId, DEFAULT_THEME_ID } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('invalid saved preferences cannot resolve to object prototype properties', () => {
  assert.ok(isThemeId(DEFAULT_THEME_ID));
  for (const id of [null, undefined, '', 'missing', '__proto__', 'constructor', {}, 1]) {
    assert.equal(isThemeId(id), false);
  }
});

test('every theme provides valid assets, sharing the original intro logo', async () => {
  for (const theme of Object.values(themes)) {
    assert.deepEqual(Object.keys(theme.assets).sort(), Object.keys(themes.christmas.assets).sort());
    assert.equal(theme.assets.emblem, themes.christmas.assets.emblem);
    assert.equal(theme.animatedEmblem, true);
    for (const [role, path] of Object.entries(theme.assets)) {
      if (role !== 'emblem') assert.ok(path.startsWith(`./${theme.name}/`), path);
      assert.ok((await stat(new URL(path, registryUrl))).size > 0, path);
    }
  }
});

test('every supplied Halloween file is assigned to a visible role', async () => {
  const files = await readdir(new URL('../themes/Halloween/', import.meta.url));
  const used = new Set(Object.values(themes.halloween.assets));
  for (const file of files) assert.ok(used.has(`./Halloween/${file}`), file);
});

test('Halloween loading uses the broom and has a distinct welcome color', () => {
  assert.match(themes.halloween.assets.loadingCharacter, /halloween_dog_broom\.png$/);
  assert.equal(themes.halloween.animatedCharacter, false);
  assert.match(themes.christmas.assets.loadingCharacter, /benjie_christmas_running\.gif$/);
  assert.notEqual(themes.halloween.colors.intro, themes.christmas.colors.intro);
});
