/**
 * Phase globale de la partie, pilotée par l'admin (docs/SPEC.md §2).
 * - `open`     : on dépose ses photos et on remplit sa feuille de devinettes
 * - `locked`   : tout est figé, en attente du show de révélation
 * - `revealed` : scores et classement visibles par tout le monde
 */
export type GamePhase = 'open' | 'locked' | 'revealed'
