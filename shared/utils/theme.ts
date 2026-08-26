import type { ThemeChoice, ThemeClass, ThemeImpose } from '../types/theme'

const CHOIX: readonly ThemeChoice[] = ['auto', 'clair', 'sombre']
const IMPOSES: readonly ThemeImpose[] = ['clair', 'sombre']

/**
 * Pages vidéoprojetées dans une pièce sombre : le show de révélation et son
 * podium (M7).
 *
 * C'est un FILET, pas le mécanisme : une page déclare son thème elle-même avec
 * `definePageMeta({ theme: 'sombre' })`, ce qui est plus sûr — la déclaration
 * vit dans la page concernée et suit ses renommages d'URL. Mais si M7 oublie,
 * ces chemins restent sombres quand même. Comparaison par préfixe de segment,
 * la position dans le show devant être adressable par l'URL.
 */
export const TOUJOURS_SOMBRE = ['/reveal'] as const

/** Un cookie trafiqué à la main ne doit pas finir dans l'attribut `class`. */
export function estThemeChoice(valeur: unknown): valeur is ThemeChoice {
  return CHOIX.includes(valeur as ThemeChoice)
}

export function estThemeImpose(valeur: unknown): valeur is ThemeImpose {
  return IMPOSES.includes(valeur as ThemeImpose)
}

/** Le thème imposé par la page, `undefined` si elle laisse le réglage décider. */
export function themeImpose(meta: unknown, chemin: string): ThemeImpose | undefined {
  if (estThemeImpose(meta)) return meta

  const vitDansLeNoir = TOUJOURS_SOMBRE.some(
    base => chemin === base || chemin.startsWith(`${base}/`),
  )

  return vitDansLeNoir ? 'sombre' : undefined
}

/**
 * Classe à poser sur `<html>`.
 *
 * Priorité : ce qu'impose la page, puis le choix de la personne. `auto` ne pose
 * rien — le serveur ne reçoit jamais `prefers-color-scheme`, donc c'est la
 * media query qui tranche, dans le navigateur et avant le premier paint.
 *
 * Fonction pure exprès : c'est l'invariant « /reveal reste sombre quoi qu'il
 * arrive », et il se teste sans monter Nuxt (tests/unit/theme.spec.ts).
 */
export function classeDeTheme(entree: {
  cookie: unknown
  meta: unknown
  chemin: string
}): ThemeClass {
  const impose = themeImpose(entree.meta, entree.chemin)
  const choix = estThemeChoice(entree.cookie) ? entree.cookie : 'auto'

  switch (impose ?? choix) {
    case 'clair': return 'light'
    case 'sombre': return 'dark'
    default: return ''
  }
}
