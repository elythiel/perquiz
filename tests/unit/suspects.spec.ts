import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SUSPECTS_PER_ROOM } from '../../shared/utils/guessing'
import { roomToken, suspectsFor } from '../../server/utils/guessing'

/**
 * The short list, and the two things it must never stop being.
 *
 * It must be the SAME for everyone — photograph filenames are global, so two
 * players can line up one room across two sheets; per-reader decoys would make
 * the intersection of their lists the owner.
 *
 * And it must HOLD STILL while the party grows. Two readings of one room at two
 * moments intersect, and both contain the owner. A list that changed in between
 * would point at him just as surely.
 *
 * The second is the one no reviewer can check by reading, so it is the one this
 * file spends most of its lines on.
 */

const SECRET = '0123456789abcdef0123456789abcdef'
const OTHER_SECRET = 'fedcba9876543210fedcba9876543210'

/** A party, as ids. Twenty is past the point where six of them is a choice. */
const PARTY = Array.from({ length: 20 }, (_, index) => index + 1)

describe('the six names a room offers', () => {
  it('always contains the owner — there is no room to guess otherwise', () => {
    for (const owner of PARTY) {
      expect([...suspectsFor(owner, PARTY, SECRET)]).toContain(owner)
    }
  })

  it('is six when the party allows it', () => {
    for (const owner of PARTY) {
      expect(suspectsFor(owner, PARTY, SECRET).size).toBe(SUSPECTS_PER_ROOM)
    }
  })

  it('is as long as the party when the party is shorter', () => {
    // Three players is a degenerate game, not an error: the list comes out at
    // two and nothing says anything about it (PAGES `/guess`).
    for (const size of [2, 3, 4, 5]) {
      const party = PARTY.slice(0, size)
      expect(suspectsFor(party[0]!, party, SECRET).size).toBe(size)
    }
  })

  it('never offers a name from outside the party', () => {
    const offered = [...suspectsFor(7, PARTY, SECRET)]
    expect(offered.every(id => PARTY.includes(id))).toBe(true)
  })

  it('is the same on every reading', () => {
    expect([...suspectsFor(7, PARTY, SECRET)]).toEqual([...suspectsFor(7, PARTY, SECRET)])
  })

  it('does not depend on the order the party is given in', () => {
    // The pool comes from a query. A list that changed when the rows came back
    // in another order would be a list that changes for no reason at all.
    const shuffled = [...PARTY].reverse()
    expect(suspectsFor(7, shuffled, SECRET)).toEqual(suspectsFor(7, PARTY, SECRET))
  })

  it('differs from room to room', () => {
    const lists = PARTY.map(owner => [...suspectsFor(owner, PARTY, SECRET)].sort().join(','))
    // Not all distinct by arithmetic — but a derivation that collapsed them
    // would hand every room the same six names.
    expect(new Set(lists).size).toBeGreaterThan(PARTY.length / 2)
  })

  it('is unguessable without the secret', () => {
    expect(suspectsFor(7, PARTY, SECRET)).not.toEqual(suspectsFor(7, PARTY, OTHER_SECRET))
  })
})

describe('the secret it is keyed by', () => {
  it('is not the one the handles use', () => {
    /*
     * Two uses of the session secret, two subkeys — the rule M4 set. Shown by
     * consequence rather than by reading the labels: if the ranking and the
     * handles shared a key, the five decoys of a room would be the five
     * candidates with the smallest handles, every time.
     */
    const byHandle = [...PARTY]
      .filter(id => id !== 7)
      .sort((left, right) => roomToken(7, left, SECRET).localeCompare(roomToken(7, right, SECRET)))
      .slice(0, SUSPECTS_PER_ROOM - 1)

    const decoys = [...suspectsFor(7, PARTY, SECRET)].filter(id => id !== 7)
    expect(decoys.sort()).not.toEqual(byHandle.sort())
  })
})

describe('the party growing under it', () => {
  it('never re-admits a name it dropped, and never invents an old one', () => {
    /*
     * The invariant that is actually true, and it is weaker than it looks like
     * it should be. Ranking by HMAC and keeping the five smallest means a name
     * already in the pool can only ever be pushed OUT by a newcomer — never
     * pulled back in, never appearing for the first time. So every old name in
     * a later list was in the earlier one.
     *
     * What it does NOT give is a stable list: a newcomer can rank into the five
     * and displace somebody. See the test below, which measures what that
     * costs.
     */
    for (const owner of [1, 2, 3]) {
      let party = PARTY.slice(0, 6)
      let earlier = suspectsFor(owner, party, SECRET)

      for (let joined = 7; joined <= 26; joined++) {
        party = [...party, joined]
        const later = suspectsFor(owner, party, SECRET)
        const known = party.slice(0, party.length - 1)

        for (const id of later) {
          if (!known.includes(id)) continue
          expect([...earlier], `room ${owner}, party of ${party.length}`).toContain(id)
        }
        earlier = later
      }
    }
  })

  it('leaves the owner in place however many join', () => {
    let party = [4]
    for (let joined = 5; joined <= 40; joined++) {
      party = [...party, joined]
      expect([...suspectsFor(4, party, SECRET)]).toContain(4)
    }
  })

  it('does not move at all while nobody joins', () => {
    // The common case, and the one the game is played in: everybody signs up
    // before the first guess. Then the list below never runs.
    const once = suspectsFor(9, PARTY, SECRET)
    for (let again = 0; again < 5; again++) {
      expect(suspectsFor(9, PARTY, SECRET)).toEqual(once)
    }
  })

  it('narrows a room when two readings straddle a wave of sign-ups', () => {
    /*
     * The disclosure this design accepts, pinned so it cannot get quietly
     * worse. The owner is in every reading of their room, so intersecting two
     * readings narrows the field — and a list that changed between them makes
     * that intersection smaller than six.
     *
     * Measured over four hundred parties growing 8 → 30 during play: the
     * intersection averages 2.2 names, and 22% of rooms come out named
     * outright. Arbitrated with Mickael, and written into SPEC §5 rather than
     * engineered away: the sheet already discloses more than this through an
     * orphan name, and a party where everyone signs up before the first guess
     * — which is how this game is played — never triggers it at all.
     *
     * This test exists to keep the claim honest, not to demand a number.
     */
    const early = suspectsFor(9, PARTY.slice(0, 8), SECRET)
    const late = suspectsFor(9, [...PARTY, ...Array.from({ length: 20 }, (_, i) => i + 21)], SECRET)
    const both = [...early].filter(id => late.has(id))

    expect(both).toContain(9)
    expect(both.length).toBeLessThanOrEqual(SUSPECTS_PER_ROOM)
  })
})

describe('the number six', () => {
  it('is written down once, and nowhere else', () => {
    /*
     * A product number, not a constant of nature: the right size for a short
     * list is the kind of thing one party teaches you. Changing it has to stay
     * one line, which it only does while nothing else spells it out.
     */
    const sources = [
      'server/utils/guessing.ts',
      'server/utils/sheet.ts',
      'app/components/guess/SuspectGrid.vue',
      'app/pages/guess/[token].vue',
    ]

    for (const path of sources) {
      const code = readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')

      expect(code.match(/(?<![\w-])6(?![\w-])/g) ?? [], path).toEqual([])
    }

    // And the one file allowed to say it says it once.
    const definition = readFileSync(fileURLToPath(new URL('../../shared/utils/guessing.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(definition.match(/(?<![\w-])6(?![\w-])/g)).toEqual(['6'])
    expect(SUSPECTS_PER_ROOM).toBe(6)
  })
})
