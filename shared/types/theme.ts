/**
 * Réglage de thème choisi par la personne (docs/SPEC.md n'en parle pas : c'est
 * une préférence d'affichage, pas une règle de jeu). `auto` suit le système.
 */
export type ThemeChoice = 'auto' | 'clair' | 'sombre'

/**
 * Thème qu'une page impose, quel que soit le réglage : elle tranche, ou elle
 * se taît. Pas d'`auto` ici — une page qui laisse choisir ne déclare rien.
 */
export type ThemeImpose = Exclude<ThemeChoice, 'auto'>

/**
 * Classe posée sur `<html>`, seule chose que le reste de l'app voit du thème.
 * La chaîne vide vaut « auto » : aucune classe, et c'est la media query de
 * `main.css` qui tranche — elle seule connaît `prefers-color-scheme`.
 */
export type ThemeClass = '' | 'light' | 'dark'
