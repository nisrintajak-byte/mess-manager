/**
 * Privacy Policy and Terms (PRD §20). The texts are DRAFTS until a lawyer signs them off.
 * Bump LEGAL_VERSION whenever a text changes in a way users must accept again: everyone is then
 * asked to accept the new version before continuing (consent re-prompt).
 */
import ar from './ar.json';
import en from './en.json';
import hi from './hi.json';
import ur from './ur.json';

export const LEGAL_VERSION = '2026-10-v5';

export type LegalSection = { h: string; p: string[] };
export type LegalDoc = { title: string; sections: LegalSection[] };
export type LegalTexts = { draft: string; updated: string; privacy: LegalDoc; terms: LegalDoc };

const TEXTS: Record<string, LegalTexts> = { en, ar, ur, hi };

export function legalTexts(lang: string): LegalTexts {
  return TEXTS[lang] ?? en;
}
