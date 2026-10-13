import { api } from "./api";

/** All wallet operations are performed by the API; no browser wallet is needed. */
export async function recordDocumentOnServer(documentId: string) {
  const { data } = await api.post(`/documents/${encodeURIComponent(documentId)}/sign/confirm`, {}, {
    timeout: 180_000,
  });
  return data;
}
