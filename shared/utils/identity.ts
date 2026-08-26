/**
 * How a person is shown when there is no room for their whole name.
 *
 * Shared because two screens draw the same person: the header chip and the
 * suspect card on the guess sheet. The colour has to be the same in both, or
 * "the blue one" stops meaning anything.
 */

/** The design system's five identity accents, as flat-plus-ink pairs. */
const ACCENTS = [
  'bg-torch/20 text-torch-ink',
  'bg-clue/20 text-clue-ink',
  'bg-alert/20 text-alert-ink',
  'bg-amber/20 text-amber-ink',
  'bg-azure/20 text-azure-ink',
] as const

/** Always two letters: "Claire Dupont" -> CD, "Sofia" -> SO. */
export function initialsOf(displayName: string): string {
  const parts = displayName.split(/[\s-]+/u).filter(Boolean)
  const letters = parts.length > 1
    ? parts.slice(0, 2).map(part => part.slice(0, 1))
    : [(parts[0] ?? '').slice(0, 2)]
  return letters.join('').toLocaleUpperCase('fr-FR') || '?'
}

/** A stable accent per name: the same person keeps the same colour everywhere. */
export function accentOf(displayName: string): string {
  const sum = [...displayName].reduce((total, char) => total + char.charCodeAt(0), 0)
  return ACCENTS[sum % ACCENTS.length] ?? ACCENTS[0]
}
