/** The bare minimum the shell needs: who is signed in, and are they an admin. */
export interface SessionUser {
  displayName: string
  isAdmin: boolean
}
