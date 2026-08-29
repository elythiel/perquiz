import type { UploadFailure } from '#shared/utils/photos'
import { isUploadFailure } from '#shared/utils/photos'

/**
 * Sending photos, one request per file.
 *
 * `fetch` cannot report how much of a body has gone out, and a phone pushing a
 * 12 Mo photo over 4G needs to show that something is happening — so this uses
 * XHR, which can. One request per file also means a refused file is just that
 * request failing, leaving the others alone (PAGES `/my-room`).
 */

export type UploadStatus = 'sending' | 'processing' | 'failed'

export interface Upload {
  id: number
  fileName: string
  status: UploadStatus
  /** 0-100 while the bytes are going out; meaningless afterwards. */
  percent: number
  /** An i18n key suffix under `myRoom.errors`, set once `status` is failed. */
  reason?: UploadFailure
  size: number
}

/** Three at a time: enough to keep a connection busy, few enough to stay fair. */
const PARALLEL = 3

/**
 * Which sentence to show for a refused upload.
 *
 * A list and not a shape test. This used to accept any `statusMessage` shorter
 * than forty characters as a slug, on the theory that a slug is short and a
 * sentence is long — and « The rooms are no longer editable » is thirty-two,
 * so locking the game mid-upload put `myRoom.errors.The rooms are no longer
 * editable` on the screen, and the 409 fallback written for that exact case
 * was never reached. The slugs are now the contract (`UPLOAD_FAILURES`), and
 * anything else is `failed` whatever it looks like.
 */
function reasonFrom(xhr: XMLHttpRequest): UploadFailure {
  try {
    const body = JSON.parse(xhr.responseText) as { statusMessage?: string }
    if (isUploadFailure(body.statusMessage)) return body.statusMessage
  }
  catch {
    // An empty or non-JSON body: the network, a proxy, a crash.
  }
  // Kept below the list rather than folded into it: a 409 the list does not
  // recognise still means something froze under the upload.
  return xhr.status === 409 ? 'locked' : 'failed'
}

function send(file: File, upload: Upload): Promise<boolean> {
  return new Promise((resolve) => {
    const body = new FormData()
    body.append('photo', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/my-room/photos')

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      upload.percent = Math.round((event.loaded / event.total) * 100)
      // The bytes are gone; what is left is sharp, which reports nothing.
      if (upload.percent >= 100) upload.status = 'processing'
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(true)
      upload.status = 'failed'
      upload.reason = reasonFrom(xhr)
      resolve(false)
    })

    xhr.addEventListener('error', () => {
      upload.status = 'failed'
      upload.reason = 'failed'
      resolve(false)
    })

    xhr.send(body)
  })
}

export function useRoomUploads(onStored: () => Promise<unknown> | unknown) {
  const uploads = ref<Upload[]>([])
  let nextId = 0

  /** The ones that failed, kept on screen until they are dismissed. */
  const failures = computed(() => uploads.value.filter(upload => upload.status === 'failed'))
  const inFlight = computed(() => uploads.value.filter(upload => upload.status !== 'failed'))
  const anyStored = ref(false)

  /**
   * Sends what fits, and refuses the rest without asking the server.
   *
   * The picker is `multiple`: choosing fifty photographs for a room that can
   * hold ten more must not fire fifty requests so the server can decline
   * forty. The surplus is failed locally, with the same reason the server
   * would have given, and lands in the same panel.
   */
  async function add(files: readonly File[], room: { held: number, max: number }) {
    const fits = Math.max(0, room.max - room.held)

    files.slice(fits).forEach((file) => {
      uploads.value.push(reactive<Upload>({
        id: nextId++,
        fileName: file.name,
        status: 'failed',
        reason: 'too-many',
        percent: 0,
        size: file.size,
      }))
    })

    const queue = files.slice(0, fits).map((file) => {
      const upload = reactive<Upload>({
        id: nextId++,
        fileName: file.name,
        status: 'sending',
        percent: 0,
        size: file.size,
      })
      uploads.value.push(upload)
      return { file, upload }
    })

    const workers = Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const stored = await send(next.file, next.upload)
        if (stored) {
          anyStored.value = true
          uploads.value = uploads.value.filter(upload => upload.id !== next!.upload.id)
          await onStored()
        }
      }
    })

    await Promise.all(workers)
  }

  function dismissFailures() {
    uploads.value = uploads.value.filter(upload => upload.status !== 'failed')
    anyStored.value = false
  }

  return { uploads, inFlight, failures, anyStored, add, dismissFailures }
}
