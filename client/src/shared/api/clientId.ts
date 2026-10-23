




let clientId: string | null = null;

export const CLIENT_ID_HEADER = "X-Client-Id";

export function setClientId(id: string | null | undefined) {
  clientId = id || null;
}

export function getClientId() {
  return clientId;
}

export function clientIdHeaders(): Record<string, string> {
  return clientId ? { [CLIENT_ID_HEADER]: clientId } : {};
}
