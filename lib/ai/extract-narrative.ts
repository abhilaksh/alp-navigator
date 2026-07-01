/**
 * The glm-5.2 model (served via Hapuppy/Fireworks) is a reasoning model.
 * Given enough max_tokens it finishes cleanly and routes its thinking to
 * message.reasoning_content, leaving message.content as plain prose. But if
 * generation gets cut off mid-reasoning (finish_reason: "length"), the
 * unfinished analysis/drafting itself ends up in `content` -- e.g. "1.
 * **Analyze the Request:** ... 3. **Drafting - Attempt 1:** Amsterdam is
 * best in late spring...". This is a last-resort cleanup for that case;
 * the real fix is giving the call enough max_tokens to finish naturally.
 *
 * IMPORTANT: this must never touch genuinely clean output. An earlier
 * version always picked "the last complete-looking group" out of the text,
 * which corrupted normal multi-paragraph replies (e.g. a WhatsApp message
 * ending in an emoji or "[preview link]" placeholder) by discarding the
 * real content and keeping only a trailing fragment, because the ending
 * didn't match a narrow "sentence looks finished" check. So this now only
 * ever rewrites the text when it can find explicit contamination markers
 * (numbered analysis headers, "let me draft", etc.) -- otherwise the raw
 * text is returned completely untouched.
 */
const META_LINE =
  /^(let'?s|let me|i need|i'll|i will|the user wants|analyz|deconstruct|draft:?$|refine:?$|refining|attempt \d|check(ing)?|review(ing)?|constraint|that'?s (about |approximately )?\d|word count|counting|good\.?$|\d+\s*words?[.)]?$)/i;
const HEADER_LINE = /^\s*(\d+[.)]\s+)?\*\*[^*]+\*\*\s*:?\s*$/;
const BULLET_LINE = /^\s*[-*•]\s|^\s*\d+[.)]\s/;
const LABEL_PREFIX = /^(draft|final( version)?|refine[d]?|version \d+|attempt \d+)\s*:\s*/i;

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (HEADER_LINE.test(line)) return true;
  if (META_LINE.test(t)) return true;
  if (BULLET_LINE.test(line)) return true;
  return false;
}

function looksContaminated(text: string): boolean {
  const lines = text.split('\n');
  return lines.some(line => {
    const t = line.trim();
    if (!t) return false;
    return HEADER_LINE.test(line) || META_LINE.test(t) || BULLET_LINE.test(line);
  });
}

export function extractNarrative(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

  // No contamination markers at all -- trust the model's output as-is.
  // This is the common case once max_tokens gives the model room to finish.
  if (!looksContaminated(text)) return text;

  const lines = text.split('\n');
  const groups: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isNoiseLine(line)) {
      if (current.length) groups.push(current);
      current = [];
    } else {
      current.push(line.trim().replace(LABEL_PREFIX, ''));
    }
  }
  if (current.length) groups.push(current);

  if (groups.length === 0) return text;

  const joined = groups.map(g => g.join('\n').trim()).filter(Boolean);
  if (joined.length === 0) return text;

  // Later groups are usually the more-refined draft in this model's
  // draft-then-revise pattern -- take the longest one instead of guessing
  // at "sentence completeness", which misfires on emoji/bracket endings.
  return joined.reduce((best, g) => (g.length > best.length ? g : best), joined[0]);
}
