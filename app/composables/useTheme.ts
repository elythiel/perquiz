import type { ThemeImpose } from '#shared/types/theme'
import { classeDeTheme } from '#shared/utils/theme'

/**
 * Thème imposé par la page, quel que soit le réglage de la personne.
 * `/reveal` est vidéoprojeté dans une pièce sombre : il déclarera
 * `definePageMeta({ theme: 'sombre' })`.
 *
 * Les deux augmentations sont nécessaires, et pour des raisons différentes :
 * `PageMeta` contraint l'écriture (`definePageMeta`), qui accepterait sinon
 * n'importe quoi à cause de sa signature d'index `[key: string]: unknown` ;
 * `RouteMeta` type la lecture (`route.meta.theme`). Nuxt augmente lui-même
 * `PageMeta` depuis `nuxt/app`, cf. `.nuxt/types/middleware.d.ts`.
 */
declare module 'nuxt/app' {
  interface PageMeta {
    theme?: ThemeImpose
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    theme?: ThemeImpose
  }
}

/**
 * Cookie et non `localStorage` : Perquiz est rendu côté serveur, et le serveur
 * doit connaître le thème pour l'écrire dans le premier octet. Avec
 * `localStorage`, il faudrait un `<script>` inline bloquant dans le `<head>`
 * pour poser la classe avant le premier paint (ce que fait `@nuxtjs/color-mode`)
 * — un script de plus à autoriser dans la CSP que M9 mettra en place.
 */
const COOKIE = 'perquiz-theme'

/** Un an : le choix d'un thème n'a pas de raison d'expirer plus tôt. */
const MAX_AGE = 60 * 60 * 24 * 365

/** La couleur de chrome du navigateur : le fond `nuit` de chaque thème. */
const CHROME = {
  clair: '#f1f3f8',
  sombre: '#0a0b12',
} as const

/** Une valeur de `theme-color` et la media query sous laquelle elle s'applique. */
export interface ChromeColor {
  media: string
  content: string
}

/**
 * Thème de l'interface.
 *
 * Ce composable n'est qu'un emballage réactif : toute la décision vit dans
 * `classeDeTheme` (pure, testée), et les valeurs vivent dans
 * `app/assets/css/main.css` sous les mêmes noms de jetons. Aucun composant n'a
 * besoin de savoir quel thème est actif.
 *
 * PLACEHOLDER M0 : pas de sélecteur en v1, donc le cookie est en lecture seule
 * et le réglage vaut toujours `auto` en pratique. M3 ajoutera le choix
 * explicite à côté du nom affiché dans « Ma pièce » — il n'aura qu'à écrire
 * dans le cookie, tout le reste est déjà en place.
 */
export function useTheme() {
  const route = useRoute()

  const cookie = useCookie<string | null>(COOKIE, {
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })

  const themeClass = computed(() => classeDeTheme({
    cookie: cookie.value,
    meta: route.meta.theme,
    chemin: route.path,
  }))

  /**
   * `theme-color` doit basculer sans JS ni flash. En `auto`, on émet les deux
   * valeurs, chacune sous sa media query, et le navigateur choisit. Sur un
   * thème résolu, la valeur retenue passe à `all` et l'autre à `not all`, qui
   * ne matche jamais.
   */
  const chrome = computed<ChromeColor[]>(() => {
    if (themeClass.value === 'light') {
      return [
        { media: 'all', content: CHROME.clair },
        { media: 'not all', content: CHROME.sombre },
      ]
    }
    if (themeClass.value === 'dark') {
      return [
        { media: 'not all', content: CHROME.clair },
        { media: 'all', content: CHROME.sombre },
      ]
    }
    return [
      { media: '(prefers-color-scheme: light)', content: CHROME.clair },
      { media: '(prefers-color-scheme: dark)', content: CHROME.sombre },
    ]
  })

  return { themeClass, chrome }
}
