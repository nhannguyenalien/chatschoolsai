// The chat widget sends the language of the page it sits on (`lang`). For bots whose response_language is "auto" the
// Worker appends this hint to the customer's message (NOT to the shared workspace prompt: that is one prompt for all
// visitors, so a per-visitor language there would race between concurrent visitors).
const NAMES = {
  vi: 'Vietnamese', en: 'English', id: 'Indonesian', ms: 'Malay', tl: 'Filipino (Tagalog)', fil: 'Filipino (Tagalog)',
  ja: 'Japanese', es: 'Spanish', fr: 'French', ko: 'Korean', zh: 'Chinese', th: 'Thai', de: 'German', pt: 'Portuguese',
  it: 'Italian', ru: 'Russian'
};

export function pageLanguageName(code) {
  const value = String(code ?? '').trim().toLowerCase();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(value)) return '';
  return NAMES[value] || NAMES[value.split('-')[0]] || '';
}

export function pageLanguageHint(code) {
  const name = pageLanguageName(code);
  if (!name) return '';
  return `(Reply language note: the customer is on a page written in ${name}. Reply in ${name}, unless the customer's message above is clearly written in a different language; in that case reply in the language of that message.)`;
}
