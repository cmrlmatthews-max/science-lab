// Reading-level helper (Flesch-Kincaid grade). Used by tests/text-*.test.mjs.
// gradeOf(text) -> number. A value of 6 means a sixth-grade reader can follow the text.
export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouyd]ed|[^laeiouy]e)$/, (m) => m[0]);
  w = w.replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
export function stats(text) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/[.!?]+(?:\s|$)/).filter((s) => /[a-zA-Z]/.test(s));
  const words = clean.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return { sentences: Math.max(1, sentences.length), words: words.length, syllables: syl };
}
export function gradeOf(text) {
  const s = stats(text);
  if (!s.words) return 0;
  return 0.39 * (s.words / s.sentences) + 11.8 * (s.syllables / s.words) - 15.59;
}
/** Collect every string in a nested value (objects, arrays). Skips keys in `skip`. */
export function strings(value, skip = []) {
  const out = [];
  (function walk(v, key) {
    if (skip.includes(key)) return;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  })(value, '');
  return out;
}
/** Longest sentence length in words. */
export function longestSentence(text) {
  return Math.max(0, ...String(text).split(/[.!?]+(?:\s|$)/).map((s) => s.split(/\s+/).filter(Boolean).length));
}
