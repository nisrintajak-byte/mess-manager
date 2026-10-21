/**
 * In-app user guide (founder 2026-10-21): short step lists for members and Admins, in all four
 * languages. Button names in the steps match the app's own labels.
 */
import ar from './ar.json';
import en from './en.json';
import hi from './hi.json';
import ur from './ur.json';

export type HelpTopic = { id: string; icon: string; admin: boolean; title: string; steps: string[] };
export type HelpTexts = {
  title: string;
  intro: string;
  everyone: string;
  admins: string;
  topics: HelpTopic[];
  contact: string;
};

const TEXTS: Record<string, HelpTexts> = { en, ar, ur, hi };

export function helpTexts(lang: string): HelpTexts {
  return TEXTS[lang] ?? en;
}

export const HELP_LANGS = Object.keys(TEXTS);
