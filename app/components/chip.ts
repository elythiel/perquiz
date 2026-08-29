/**
 * What a text pill wears, and the type its callers speak.
 *
 * Split out of `<BaseChip>` for the same reason `button.ts` is split out of the
 * two button components: `<ShellPhaseChip>` keeps a table of four phases and
 * has to name a tint in it, so the vocabulary has to exist somewhere both files
 * can import it from — a type reached through `InstanceType<typeof …>` is the
 * kind of thing that quietly stops resolving.
 *
 * Inks and not flats. `torch-ink`, `clue-ink`, `amber-ink` and `edge-strong`
 * are the tokens tests/unit/contrast.spec.ts already holds at 3:1 against the
 * three grounds in both themes, so an underline that reuses one of them is
 * covered by a measurement that exists. A colour from outside that list would
 * not be, and nothing would go red.
 */
export const CHIP_TONES = {
  torch: 'border-torch-ink text-torch-ink',
  clue: 'border-clue-ink text-clue-ink',
  amber: 'border-amber-ink text-amber-ink',
  edge: 'border-edge-strong text-text-muted',
} as const

export type ChipTone = keyof typeof CHIP_TONES
