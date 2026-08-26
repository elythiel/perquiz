import { readFileSync } from 'node:fs'

/**
 * Lecture des jetons du design system et calcul des ratios de contraste.
 *
 * Le CSS est la seule source de vérité : ce module lit
 * `app/assets/css/main.css` sur le disque plutôt que de recopier les valeurs,
 * pour qu'un jeton modifié dans le CSS soit mesuré au test suivant sans que
 * personne ait à penser à synchroniser quoi que ce soit.
 */

const CSS_PATH = new URL('../../app/assets/css/main.css', import.meta.url)

/** Table jeton → valeur, les noms dépouillés de leur préfixe `--color-`. */
export type Palette = Record<string, string>

/**
 * Corps d'un bloc CSS, accolades équilibrées. Un simple `/\{([^}]*)\}/` ne
 * suffit pas : `@theme` contient des `@keyframes` imbriquées.
 */
function corpsDuBloc(css: string, ouverture: RegExp): string {
  const entete = ouverture.exec(css)
  if (!entete) throw new Error(`Bloc introuvable dans main.css : ${ouverture}`)

  const debut = css.indexOf('{', entete.index)
  let profondeur = 0

  for (let i = debut; i < css.length; i++) {
    if (css[i] === '{') profondeur++
    else if (css[i] === '}' && --profondeur === 0) return css.slice(debut + 1, i)
  }

  throw new Error(`Accolade non fermée dans main.css : ${ouverture}`)
}

/** Les déclarations de propriétés personnalisées d'un bloc, dans l'ordre. */
function declarations(corps: string): Palette {
  return Object.fromEntries(
    [...corps.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, nom, valeur]) => [nom!, valeur!.trim()]),
  )
}

/** Les seules déclarations de couleur, préfixe `color-` retiré. */
function couleurs(brut: Palette): Palette {
  return Object.fromEntries(
    Object.entries(brut)
      .filter(([nom]) => nom.startsWith('color-'))
      .map(([nom, valeur]) => [nom.slice('color-'.length), valeur]),
  )
}

export interface DesignSystem {
  /** Palette du thème sombre : les valeurs déclarées dans `@theme`. */
  sombre: Palette
  /** Palette du thème clair : `@theme` recouvert par les surcharges. */
  clair: Palette
  /** Surcharges claires du sélecteur `.light` (choix explicite). */
  surchargesClasse: Palette
  /** Surcharges claires de la media query (réglage « auto »). */
  surchargesMedia: Palette
  /** Opacité du halo de lampe torche, en fraction. */
  haloAlpha: number
  /** Taille des étiquettes mono, telle qu'écrite (ex. `0.6875rem`). */
  tailleEtiquette: string
}

export function lireDesignSystem(): DesignSystem {
  const css = readFileSync(CSS_PATH, 'utf8')

  const theme = declarations(corpsDuBloc(css, /@theme\s*\{/))
  const surchargesClasse = couleurs(declarations(corpsDuBloc(css, /\.light\s*\{/)))
  const surchargesMedia = couleurs(declarations(corpsDuBloc(css, /:root:not\(\.dark\)\s*\{/)))

  const sombre = couleurs(theme)

  const halo = /@utility halo-torche[\s\S]*?var\(--color-torche\)\s+(\d+(?:\.\d+)?)%/.exec(css)
  if (!halo) throw new Error('Opacité du halo introuvable dans main.css')

  const etiquette = theme['text-etiquette']
  if (!etiquette) throw new Error('--text-etiquette introuvable dans main.css')

  return {
    sombre,
    clair: { ...sombre, ...surchargesClasse },
    surchargesClasse,
    surchargesMedia,
    haloAlpha: Number(halo[1]) / 100,
    tailleEtiquette: etiquette,
  }
}

/** Composante sRGB linéarisée, définition WCAG 2.x. */
function lineaire(composante: number): number {
  const c = composante / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function canaux(hex: string): [number, number, number] {
  const brut = hex.trim().replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(brut)) throw new Error(`Couleur illisible : ${hex}`)

  return [0, 2, 4].map(i => Number.parseInt(brut.slice(i, i + 2), 16)) as [number, number, number]
}

/** Luminance relative WCAG 2.x. */
function luminance(hex: string): number {
  const [r, g, b] = canaux(hex)
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b)
}

/** Ratio de contraste WCAG 2.x entre deux couleurs opaques, de 1 à 21. */
export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (clair + 0.05) / (sombre + 0.05)
}

/**
 * Aplatit une couleur translucide sur son fond, en sRGB.
 *
 * C'est bien ce que fait le navigateur pour un `bg-torche/20` : Tailwind v4
 * compile le modificateur d'opacité en
 * `color-mix(in oklab, var(--color-torche) 20%, transparent)`, et mélanger une
 * couleur avec `transparent` en interpolation prémultipliée rend exactement la
 * couleur d'origine à alpha 0,20 — la composition sur le fond, elle, a lieu à
 * la peinture, en sRGB.
 */
export function aplati(couleur: string, alpha: number, fond: string): string {
  const dessus = canaux(couleur)
  const dessous = canaux(fond)

  return `#${dessus
    .map((valeur, i) => Math.round(alpha * valeur + (1 - alpha) * dessous[i]!)
      .toString(16)
      .padStart(2, '0'))
    .join('')}`
}
