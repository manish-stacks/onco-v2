import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Recent searches" — stored locally on the device, most-recent-first,
 * capped at MAX items, de-duplicated (case-insensitive).
 */
const KEY = 'ohm_search_history';
const MAX = 10;

export async function getSearchHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Call this once a search actually returns (or is submitted) so junk keystrokes aren't saved. */
export async function addSearchTerm(term) {
  const clean = String(term || '').trim();
  if (!clean) return [];
  try {
    const list = await getSearchHistory();
    const next = [clean, ...list.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export async function removeSearchTerm(term) {
  try {
    const list = await getSearchHistory();
    const next = list.filter((t) => t !== term);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export async function clearSearchHistory() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}