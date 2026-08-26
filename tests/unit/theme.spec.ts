import { describe, expect, it } from 'vitest'
import { classeDeTheme, themeImpose } from '../../shared/utils/theme'

/**
 * Résolution du thème : quelle classe atterrit sur `<html>`.
 *
 * Trois entrées (le cookie, le `theme` déclaré par la page, le chemin) pour
 * trois sorties possibles. C'est peu de code mais c'est là que vit l'invariant
 * « /reveal reste sombre quel que soit le réglage » — et une régression y
 * serait invisible à l'œil, le thème restant globalement juste.
 */

const AUCUNE_META = undefined
const ACCUEIL = '/'

describe('choix de la personne, aucune page n\'imposant rien', () => {
  it.each([
    ['aucun cookie', null, ''],
    ['auto', 'auto', ''],
    ['clair', 'clair', 'light'],
    ['sombre', 'sombre', 'dark'],
  ] as const)('%s -> class="%s"', (_libelle, cookie, attendu) => {
    expect(classeDeTheme({ cookie, meta: AUCUNE_META, chemin: ACCUEIL })).toBe(attendu)
  })

  // Un cookie se trafique depuis la console : sa valeur ne doit jamais finir
  // telle quelle dans l'attribut `class`.
  it.each(['nawak', '', 'light', 'dark', '<script>x</script>', 42, null, undefined, {}])(
    'un cookie illisible (%o) retombe silencieusement sur auto',
    (cookie) => {
      expect(classeDeTheme({ cookie, meta: AUCUNE_META, chemin: ACCUEIL })).toBe('')
    },
  )
})

describe('une page qui impose son thème gagne sur le réglage', () => {
  it.each([
    ['sombre', 'clair', 'dark'],
    ['sombre', 'auto', 'dark'],
    ['sombre', null, 'dark'],
    ['clair', 'sombre', 'light'],
    ['clair', 'auto', 'light'],
  ] as const)('page=%s, cookie=%s -> class="%s"', (meta, cookie, attendu) => {
    expect(classeDeTheme({ cookie, meta, chemin: ACCUEIL })).toBe(attendu)
  })

  it.each(['auto', 'nawak', '', 'dark', 42, {}])(
    'un `theme` de page illisible (%o) est ignoré, le réglage reprend la main',
    (meta) => {
      expect(classeDeTheme({ cookie: 'clair', meta, chemin: ACCUEIL })).toBe('light')
    },
  )
})

describe('le show de révélation reste sombre même sans déclaration', () => {
  // Filet : si M7 oublie son `definePageMeta`, ces chemins restent sombres.
  it.each(['/reveal', '/reveal/3', '/reveal/12/podium'])(
    '%s est sombre malgré un cookie clair',
    (chemin) => {
      expect(classeDeTheme({ cookie: 'clair', meta: AUCUNE_META, chemin })).toBe('dark')
    },
  )

  // Le filet compare des segments, pas des chaînes : une future page dont le
  // nom commence par « reveal » ne doit pas se retrouver sombre par accident.
  it.each(['/revelation', '/reveals', '/reveal-show', '/resultats', '/'])(
    '%s n\'est pas concerné',
    (chemin) => {
      expect(classeDeTheme({ cookie: 'clair', meta: AUCUNE_META, chemin })).toBe('light')
    },
  )

  it('une page peut aussi contredire le filet et redevenir claire', () => {
    expect(themeImpose('clair', '/reveal')).toBe('clair')
    expect(classeDeTheme({ cookie: 'sombre', meta: 'clair', chemin: '/reveal' })).toBe('light')
  })
})
