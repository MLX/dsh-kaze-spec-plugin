/**
 * How Kaze skills write their user-facing prose.
 *
 * `standard` keeps the engine's usual precise, structured voice. `human`
 * appends one style contract to every Kaze command invocation so answers,
 * progress notes, summaries, and report prose read like a person wrote them,
 * in the spirit of the "humanize" writing skill (avoid model-flavoured filler,
 * rule-of-three flourishes, and translationese Chinese).
 *
 * A style never relaxes the engine: required headings, EARS syntax, task
 * markers, code, JSON, commands, and verification evidence stay exact.
 */

/** The accepted output styles, in settings order. */
export const OUTPUT_STYLES = ['standard', 'human'] as const

/** One accepted output style. */
export type OutputStyle = (typeof OUTPUT_STYLES)[number]

/** The style used before anyone saves a choice. */
export const DEFAULT_OUTPUT_STYLE: OutputStyle = 'human'

/** Source name that marks the injected style message, so it never duplicates. */
export const OUTPUT_STYLE_SOURCE = 'kaze-output-style'

/** Coerce a persisted value; anything unrecognized falls back. */
export function normalizeOutputStyle(
  value: unknown,
  fallback: OutputStyle = DEFAULT_OUTPUT_STYLE,
): OutputStyle {
  return value === 'human' || value === 'standard' ? value : fallback
}

/**
 * The model-facing instruction block for one style.
 * @param style - the configured style.
 * @returns the block, or an empty string when no style should be injected.
 */
export function outputStyleBlock(style: OutputStyle): string {
  if (style !== 'human') return ''
  return [
    '<kaze_output_style mode="human">',
    'Write your replies the way a person talks to a colleague. This covers chat',
    'answers, progress notes, summaries, review comments, and ordinary prose inside',
    'reports and spec documents.',
    '',
    '- Lead with the answer, then the reason. Do not restate the request. Never open',
    '  with "Certainly", "Great question", "Sure", or "Here\'s what I did".',
    '- Use plain words and concrete verbs: "use", not "leverage"; "check", not',
    '  "perform a validation"; "fix", not "remediate".',
    '- Vary sentence length. A short sentence is fine. Reach for a list only when the',
    '  items are parallel facts, not to hide a paragraph.',
    '- Drop the AI tells: rule-of-three flourishes ("fast, reliable, and scalable"),',
    '  "not just X, but Y", "it\'s not X, it\'s Y", em-dash pile-ups, bold on every',
    '  phrase, and openers or closers such as "Moreover", "Furthermore", "Overall",',
    '  "In conclusion", or "Let me know if you have any questions".',
    '- 中文按人说话的习惯写：少用"赋能、闭环、抓手、沉淀、对齐、链路"这类词，别写',
    '  "进行一个……的操作"这种翻译腔，也别堆四字词。结论先说，一句话说清一件事。',
    '- Be honest. If a check failed, say it failed and show the output. If you did not',
    '  run something, say you did not. Do not dress a guess up as a fact.',
    '- Keep every exact fact exact: commands, paths, file names, numbers, error text,',
    '  and verification output. A human voice never trims evidence.',
    '- Keep every required form: document headings, EARS statement syntax, task',
    '  markers, code, JSON, and command output. A formal document or a fixed template',
    '  keeps its format; humanize only the prose inside it.',
    '</kaze_output_style>',
  ].join('\n')
}
