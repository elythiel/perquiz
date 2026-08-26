import { describe, expect, it } from 'vitest'
import { aplati, contraste, lireDesignSystem, type Palette } from '../support/design-system'

/**
 * Contrastes du design system, mesurés et non estimés, sur les deux thèmes.
 *
 * Les valeurs sont lues dans `app/assets/css/main.css` : ce test échoue dès
 * qu'un jeton descend sous son seuil, y compris pour une couleur ajoutée après
 * coup — les couples ci-dessous sont énumérés par nom de jeton, pas en dur.
 */

/** WCAG 2.2 : 1.4.3 pour le texte, 1.4.11 pour les éléments d'interface. */
const TEXTE = 4.5
const CONTROLE = 3

const ds = lireDesignSystem()

const THEMES = [['sombre', ds.sombre], ['clair', ds.clair]] as const satisfies readonly (readonly [string, Palette])[]

/** Les trois fonds sur lesquels du contenu peut se poser. */
const FONDS = ['nuit', 'panneau', 'fond-creux'] as const

/** Tout jeton qui porte du texte ou une icône. */
const TEXTES = [
  'texte',
  'texte-doux',
  'texte-estompe',
  'torche-texte',
  'indice-texte',
  'alerte-texte',
  'ambre-texte',
  'azur-texte',
] as const

/**
 * Les puces teintées telles qu'employées : un accent en aplat translucide,
 * l'accent en texte par-dessus. 10 % et 15 % pour la puce de phase
 * (`ShellPhaseChip`), 20 % pour la pastille d'initiales (`ShellUserChip`).
 * Elles se posent sur `nuit` (page, en-tête) ou `panneau` (barre de nav
 * mobile), jamais dans un creux.
 */
const PUCES = [
  { aplat: 'torche', alpha: 0.10, texte: 'torche-texte' },
  { aplat: 'indice', alpha: 0.15, texte: 'indice-texte' },
  { aplat: 'torche', alpha: 0.20, texte: 'torche-texte' },
  { aplat: 'indice', alpha: 0.20, texte: 'indice-texte' },
  { aplat: 'alerte', alpha: 0.20, texte: 'alerte-texte' },
  { aplat: 'ambre', alpha: 0.20, texte: 'ambre-texte' },
  { aplat: 'azur', alpha: 0.20, texte: 'azur-texte' },
] as const

/** Les neutres de texte qui peuvent tomber dans le halo de l'en-tête. */
const TEXTES_DANS_LE_HALO = ['texte', 'texte-doux', 'texte-estompe'] as const

const couples = <A extends readonly string[], B extends readonly string[]>(a: A, b: B) =>
  a.flatMap(x => b.map(y => [x, y] as const))

describe.each(THEMES)('thème %s', (_nom, palette) => {
  describe(`texte sur fond (≥ ${TEXTE}:1)`, () => {
    it.each(couples(TEXTES, FONDS))('%s sur %s', (jeton, fond) => {
      expect(contraste(palette[jeton]!, palette[fond]!)).toBeGreaterThanOrEqual(TEXTE)
    })
  })

  describe(`texte sur aplat d'accent (≥ ${TEXTE}:1)`, () => {
    // `sur-torche` est le seul texte prévu sur un aplat plein d'accent ; les
    // aplats ne bougeant pas d'un thème à l'autre, le ratio est le même dans
    // les deux — on le vérifie quand même, la valeur pourrait basculer un jour.
    it('sur-torche sur torche', () => {
      expect(contraste(palette['sur-torche']!, palette.torche!)).toBeGreaterThanOrEqual(TEXTE)
    })
  })

  describe(`bordure porteuse de sens (≥ ${CONTROLE}:1)`, () => {
    it.each(FONDS)('trait-fort sur %s', (fond) => {
      expect(contraste(palette['trait-fort']!, palette[fond]!)).toBeGreaterThanOrEqual(CONTROLE)
    })

    // L'anneau de `:focus-visible` prend l'accent EN TEXTE et non l'aplat :
    // `torche` sur un panneau blanc ne ferait que 1,4:1.
    it.each(FONDS)('anneau de focus sur %s', (fond) => {
      expect(contraste(palette['torche-texte']!, palette[fond]!)).toBeGreaterThanOrEqual(CONTROLE)
    })
  })

  describe(`puce teintée (≥ ${TEXTE}:1)`, () => {
    it.each(PUCES.flatMap(puce => (['nuit', 'panneau'] as const).map(fond => ({ ...puce, fond }))))(
      '$texte sur $aplat à $alpha, posé sur $fond',
      ({ aplat, alpha, texte, fond }) => {
        const teinte = aplati(palette[aplat]!, alpha, palette[fond]!)
        expect(contraste(palette[texte]!, teinte)).toBeGreaterThanOrEqual(TEXTE)
      },
    )
  })

  describe(`texte dans le halo de lampe torche (≥ ${TEXTE}:1)`, () => {
    // Le halo est décoratif et `aria-hidden`, mais l'en-tête et la nav de
    // bureau vivent dedans : ce qui compte est le contraste rendu, au centre
    // du dégradé où le halo est le plus opaque.
    it.each(TEXTES_DANS_LE_HALO)('%s sur le halo', (jeton) => {
      const halo = aplati(palette.torche!, ds.haloAlpha, palette.nuit!)
      expect(contraste(palette[jeton]!, halo)).toBeGreaterThanOrEqual(TEXTE)
    })
  })
})

describe('cohérence des deux thèmes', () => {
  // `.light` (choix explicite) et la media query (réglage « auto ») portent la
  // même palette, écrite deux fois parce qu'aucun sélecteur CSS ne sait
  // exprimer « la classe OU la préférence système ». Le jour où l'une des deux
  // copies dérive, c'est ici que ça casse.
  it('la classe .light et la media query déclarent la même palette', () => {
    expect(ds.surchargesMedia).toStrictEqual(ds.surchargesClasse)
  })

  it('aucune surcharge claire n\'invente un jeton absent du thème sombre', () => {
    expect(Object.keys(ds.surchargesClasse).filter(jeton => !(jeton in ds.sombre))).toStrictEqual([])
  })

  it('tous les jetons mesurés existent dans les deux thèmes', () => {
    const attendus = [...TEXTES, ...FONDS, 'trait-fort', 'sur-torche', 'torche', 'indice', 'alerte', 'ambre', 'azur']
    expect(attendus.filter(jeton => !(jeton in ds.sombre))).toStrictEqual([])
    expect(attendus.filter(jeton => !(jeton in ds.clair))).toStrictEqual([])
  })

  // En capitales mono avec 0,12em d'interlettrage, 10 px passait sous le
  // plancher confortable de lisibilité.
  it('les étiquettes mono font 11 px', () => {
    expect(ds.tailleEtiquette).toBe('0.6875rem')
  })
})
