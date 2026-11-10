import AsyncStorage from '@react-native-async-storage/async-storage';

// Retain one library namespace from the old account-based version so existing
// music, albums, and favorites stay available after accounts are removed.
const LEGACY_ACCOUNTS_KEY = 'holiday_music_accounts_v1';
const LEGACY_SESSION_KEY = 'holiday_music_session_v1';
const LOCAL_LIBRARY_ID_KEY = 'music-player.local-library-id';
const LEGACY_DATA_OWNER_KEY = 'music-player.legacy-data-owner-id';

function makeAccountId(email) {
  let hash = 2166136261;
  for (const character of email.trim().toLowerCase()) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return `account-${(hash >>> 0).toString(36)}`;
}

async function readLegacyAccounts() {
  try {
    const serialized = await AsyncStorage.getItem(LEGACY_ACCOUNTS_KEY);
    const accounts = serialized ? JSON.parse(serialized) : [];
    return Array.isArray(accounts)
      ? accounts.map((account) => ({ ...account, id: account.id || makeAccountId(account.email || '') }))
      : [];
  } catch {
    return [];
  }
}

export async function getLocalLibraryId() {
  const savedId = await AsyncStorage.getItem(LOCAL_LIBRARY_ID_KEY);
  if (savedId) return savedId;

  const accounts = await readLegacyAccounts();
  const currentEmail = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
  const currentAccount = accounts.find((account) => account.email === currentEmail);
  const libraryId = currentAccount?.id || accounts[0]?.id || 'device-library';
  const legacyOwnerId = accounts[0]?.id || libraryId;

  await AsyncStorage.multiSet([
    [LOCAL_LIBRARY_ID_KEY, libraryId],
    [LEGACY_DATA_OWNER_KEY, legacyOwnerId],
  ]);
  // Remove stored login credentials; the app now has one local library and no
  // sign-in or account-management screens.
  await AsyncStorage.multiRemove([LEGACY_ACCOUNTS_KEY, LEGACY_SESSION_KEY]);
  return libraryId;
}

export async function getLegacyLibraryOwnerId() {
  const savedOwnerId = await AsyncStorage.getItem(LEGACY_DATA_OWNER_KEY);
  if (savedOwnerId) return savedOwnerId;
  const libraryId = await getLocalLibraryId();
  await AsyncStorage.setItem(LEGACY_DATA_OWNER_KEY, libraryId);
  return libraryId;
}
