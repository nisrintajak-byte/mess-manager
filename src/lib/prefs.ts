import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small device-level preferences (language, theme, digits, App Lock settings). Never throws. */
export async function getPref(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`mm.${key}`);
  } catch {
    return null;
  }
}

export async function setPref(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`mm.${key}`, value);
  } catch {
    // preference simply won't persist
  }
}
