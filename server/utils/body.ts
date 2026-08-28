import type { H3Event } from 'h3'
// Imported rather than auto-imported, like server/utils/session.ts: this module
// is pulled in by an explicit relative path, so it carries its own h3 names.
import { createError } from 'h3'

/**
 * Reading a request body under a ceiling that holds DURING the read.
 *
 * `content-length` is a claim, and under `Transfer-Encoding: chunked` it is not
 * even made — the header is absent, so a ceiling checked before the read sees
 * zero and waves the request through. Whatever reads the body next buffers all
 * of it before anybody can measure it, which is how an authenticated player
 * sends gigabytes and takes the process's memory with them (audit, 2026-08-28).
 *
 * So the ceiling is enforced by the only thing in a position to enforce it: the
 * loop doing the reading. It counts as it goes and stops at the first chunk
 * that crosses the line, which is what makes the refusal cost the sender's
 * bytes rather than ours.
 *
 * The bytes are left in `event._requestBody`, which is the FIRST place h3's own
 * `readRawBody` looks — and therefore `readBody`, `readMultipartFormData` and
 * the rest. A handler carries on using them exactly as before, and the socket
 * is never read twice.
 */

/**
 * The ceiling for the routes whose body is a small JSON object.
 *
 * MEASURED rather than picked round: the widest legitimate payload any of them
 * accepts is the photo order at **361 bytes** — ten filenames of 32 hex
 * characters, quoted and comma-separated. Renaming yourself is 78 bytes with
 * thirty accented characters, one answer is 64, a phase is 23. Four kilobytes
 * is eleven times the largest of them, which is generous enough that no honest
 * client will ever meet it and small enough that meeting it on purpose buys an
 * attacker nothing.
 *
 * One value for the four rather than one each: the spread between 23 and 361
 * bytes is not worth four constants to keep in step, and a ceiling nobody can
 * name is a ceiling that drifts.
 */
export const JSON_BODY_CEILING = 4096

interface BodySource {
  chunks: AsyncIterable<Uint8Array>
  /** Stops the SENDER, not merely our reading of it. */
  cut: () => void
}

function bodySource(event: H3Event): BodySource | undefined {
  /*
   * The web request first, in the same order h3's own readers try: where that
   * stream exists it IS the body, and the node request beside it is a stand-in
   * with nothing in it.
   */
  const web = event.web?.request?.body
  if (web) {
    const reader = web.getReader()
    return {
      chunks: (async function* () {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) return
          yield value
        }
      })(),
      cut: () => void reader.cancel().catch(() => {}),
    }
  }

  /*
   * The node request, iterated directly rather than through
   * `getRequestWebStream`, and this is the load-bearing half.
   *
   * MEASURED in h3 1.15.11: that helper wraps `req` in a ReadableStream whose
   * `data` handler enqueues every chunk with no regard for whether anybody is
   * reading. Cancelling the reader there stops US; the sender keeps filling the
   * stream's queue, which is the memory we were trying not to spend. `for
   * await` over the node stream is pull-based instead — between two iterations
   * the socket is paused, and TCP tells the sender to wait.
   *
   * `destroyOnReturn: false` and `pause()` rather than `destroy()`, and this
   * pair was MEASURED against a real socket (2026-08-29) rather than reasoned
   * about. Node's async iterator destroys its stream when the loop exits by
   * throw — and a destroyed request socket takes the unwritten response with
   * it: the sender saw the connection drop where a 413 was promised. Pausing
   * closes the TCP window instead, which stalls the sender just as well and
   * leaves the socket alive long enough to be told why. What happens to the
   * body nobody read is node's own business once the response is out.
   *
   * This is also the branch production takes: Nitro's node handler leaves
   * `event.web` unset. The suite reaches the web branch above and not this one,
   * because the harness drives the app through `toWebHandler` — noted on the
   * card rather than papered over.
   */
  const node = event.node?.req
  if (typeof node?.iterator === 'function') {
    return {
      chunks: node.iterator({ destroyOnReturn: false }),
      cut: () => void node.pause(),
    }
  }

  return undefined
}

/**
 * Buffers the body, or refuses with 413 the moment it grows past `cap`.
 *
 * A request with no body at all is not this function's problem: it leaves
 * `_requestBody` alone, and whoever needed a body says so in its own words.
 */
export async function readBodyUnderCap(event: H3Event, cap: number): Promise<void> {
  const source = bodySource(event)
  if (!source) return

  const chunks: Uint8Array[] = []
  let read = 0

  for await (const chunk of source.chunks) {
    read += chunk.byteLength
    if (read > cap) {
      source.cut()
      throw createError({ statusCode: 413, statusMessage: 'too-large' })
    }
    chunks.push(chunk)
  }

  event._requestBody = Buffer.concat(chunks)
}
