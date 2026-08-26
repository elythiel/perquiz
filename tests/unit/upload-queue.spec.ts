import { describe, expect, it } from 'vitest'
import { queuedUsers, serialiseByUser } from '../../server/utils/upload-queue'

/**
 * The queue that bounds the expensive half of an upload.
 *
 * A photo cap protects the disk and nothing else: deleting and re-uploading in
 * a loop is unbounded work, and `sharp` decoding a 15 Mo JPEG twice is where
 * the machine actually goes. What has to be bounded is concurrency, and these
 * tests are the three things that would make it useless — overlapping work, a
 * failure wedging the line, and a chain that is never let go of.
 */

/** Resolves after `ms`, without a real timer's flakiness in a unit test. */
function later<T>(value: T, ms = 5): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

describe('one at a time, per person', () => {
  it('never runs two of the same person’s uploads at once', async () => {
    let running = 0
    let peak = 0

    const work = async () => {
      running++
      peak = Math.max(peak, running)
      await later(null)
      running--
    }

    await Promise.all(Array.from({ length: 5 }, () => serialiseByUser(1, work)))
    expect(peak).toBe(1)
  })

  it('keeps them in the order they arrived', async () => {
    const done: number[] = []
    await Promise.all([1, 2, 3, 4].map(n =>
      serialiseByUser(1, async () => {
        await later(null, 5 - n)
        done.push(n)
      })))

    expect(done).toEqual([1, 2, 3, 4])
  })

  // Twenty-five phones uploading at once is the normal case of a party game
  // and has to stay fast; one phone uploading twenty-five times is not.
  it('does not make one person wait for another', async () => {
    let together = 0
    let peak = 0

    const work = async () => {
      together++
      peak = Math.max(peak, together)
      await later(null)
      together--
    }

    await Promise.all([serialiseByUser(1, work), serialiseByUser(2, work)])
    expect(peak).toBe(2)
  })
})

describe('when an upload fails', () => {
  it('lets the next one through', async () => {
    const failed = serialiseByUser(3, () => Promise.reject(new Error('unreadable')))
    await expect(failed).rejects.toThrow('unreadable')

    await expect(serialiseByUser(3, () => Promise.resolve('ok'))).resolves.toBe('ok')
  })

  it('surfaces the error to its own caller and to nobody else', async () => {
    const results = await Promise.allSettled([
      serialiseByUser(4, () => Promise.reject(new Error('boom'))),
      serialiseByUser(4, () => Promise.resolve('fine')),
    ])

    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
  })
})

describe('what it holds on to', () => {
  it('forgets a person once their queue is empty', async () => {
    await serialiseByUser(99, () => later('done'))
    // The tail is dropped on a microtask after the last job settles.
    await later(null, 10)
    expect(queuedUsers()).toBe(0)
  })
})
