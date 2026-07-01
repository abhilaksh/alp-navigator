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
 * Headers and their content often share a single newline (no blank line
 * between them), so paragraph-splitting doesn't isolate them -- this works
 * line by line instead, grouping consecutive "prose-looking" lines and
 * keeping the last complete-looking group.
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

function endsCompletely(s: string): boolean {
  return /[.!?"']\s*$/.test(s.trim());
}

export function extractNarrative(raw: string): string {
  const text = raw.trim();
  if (!text) return '';

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

  // Prefer the last group that reads as a finished sentence -- later groups
  // are usually more-refined drafts, but a truncated final attempt is worse
  // than a complete earlier one.
  for (let i = joined.length - 1; i >= 0; i--) {
    if (endsCompletely(joined[i])) return joined[i];
  }

  return joined[joined.length - 1];
}
