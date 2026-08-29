/**
 * Ordering by a key that costs something to compute.
 *
 * Four places in this codebase sort by a keyed digest — the deck a player
 * walks, the short list of suspects a room offers, the order the show deals
 * its rooms in, and the moderation grid. All four want the same thing: an
 * order nobody can read anything into, that holds still between calls.
 *
 * All four also wrote it the same way, and the same way was the naive one —
 * `sort((a, b) => rank(a).localeCompare(rank(b)))` recomputes the digest on
 * every comparison, so an n-item sort costs about 2·n·log₂(n) HMACs instead of
 * n. It is the only synchronous CPU in the app that grows faster than the
 * party does: twenty-five players put roughly four thousand HMACs behind a
 * single GET /api/admin, where a hundred and fifty would do.
 *
 * Decorate, sort, undecorate. The comparator is `localeCompare` on the key,
 * unchanged and deliberately so: the tests pin real digests and a real grid
 * order, and those golden values are the evidence that this rewrite moved
 * nothing. If they shift, the helper is wrong rather than the tests.
 */
export function rankBy<T>(items: readonly T[], rank: (item: T) => string): T[] {
  return items
    .map(item => ({ item, key: rank(item) }))
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(ranked => ranked.item)
}
