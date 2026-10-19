/** Phone app: Google consent form (UMP) where the law requires it, then the ad SDK. */
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

import { loadAdPrefs } from './adPrefs';
import { ADS_ENABLED } from './adsConfig';

let started = false;

export async function initAds(): Promise<void> {
  if (!ADS_ENABLED || started) return;
  started = true;
  await loadAdPrefs();
  try {
    // shows Google's certified consent form only to users who need it (EEA, UK, Switzerland)
    await AdsConsent.gatherConsent();
  } catch {
    // no form → ads stay non-personalised by the SDK's own rules
  }
  try {
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG, // family-safe content only
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
  } catch {
    // ads are optional; the app works without them
  }
}

export async function privacyOptionsRequired(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

export async function showPrivacyOptions(): Promise<void> {
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch {
    // nothing to show
  }
}
