/** Le strict nécessaire pour la coquille : qui est connecté, et est-il admin. */
export interface SessionUser {
  displayName: string
  isAdmin: boolean
}
