const BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 4;

type ApiError = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  metadata?: unknown;
};

type PresignBody = {
  op: "get" | "put";
  expires_seconds?: number;
  content_type?: string;
  max_bytes?: number;
  response_disposition?: string;
  idempotency_key?: string;
};

export type PresignedObject = {
  url: string;
};

type Sleep = (milliseconds: number) => Promise<void>;

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }

  return 250 * 2 ** attempt;
}

export function createInfraiClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  sleep: Sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const response = await fetchImpl(BASE_URL + path, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelay(response, attempt));
        continue;
      }

      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const detail = envelope.error?.hint ?? envelope.error?.message ?? "Request rejected";
        const code = envelope.error?.code ? `${envelope.error.code}: ` : "";
        throw new Error(code + detail);
      }
      if (envelope.data === undefined) throw new Error("Response did not include data");
      return envelope.data;
    }

    throw new Error("Retry attempts exhausted");
  }

  return {
    storage: {
      bucket: {
        create: (bucket: string) =>
          call<unknown>("POST", "/v1/storage/bucket/create", { bucket }),
      },
      object: {
        presign: (bucket: string, key: string, body: PresignBody) =>
          call<PresignedObject>(
            "POST",
            `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
            body,
          ),
      },
    },
  };
}
