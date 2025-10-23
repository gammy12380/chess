const CLIENT_ID_STORAGE_KEY = 'vue-chess-client-id'

export function getClientId() {
  if (typeof window === 'undefined') {
    return crypto.randomUUID()
  }

  let clientId = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)
  if (!clientId) {
    clientId = crypto.randomUUID()
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId)
  }
  return clientId
}
