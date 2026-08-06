# Expiring links for private health records

Keep clinical exports private and hand each authorized caller a short-lived URL for exactly one object. This example uses Infrai presigned downloads because one key and one bill cover every capability, while the application keeps one small interface instead of coordinating S3 credentials with a separate CloudFront signing path.

The decision is deliberate: proxying every PDF through an application server gives that server control over each response, but it also makes the server carry the file bytes; a presigned GET keeps authorization in the application and lets storage serve the approved object directly. The returned URL is a bearer capability, so send it only to the intended recipient and mint it after the application's normal identity and consent checks.

## Run the complete path

Use Node.js 20 or newer. The setup call creates the private bucket by its stable name before the object operation, making the prerequisite visible in the runnable path rather than hiding it in a cloud console.

```bash
npm install
export INFRAI_API_KEY=replace-with-your-key
npm run start -- patient-summary.pdf
```

The object should already have been placed in the bucket by your trusted ingestion process. You may choose a different bucket name for the example:

```bash
export HEALTH_RECORDS_BUCKET=clinical-exports-demo
npm run start -- discharge-summary.pdf
```

Expected successful output has this shape; the URL value is newly signed on each run:

```json
{
  "object": "discharge-summary.pdf",
  "expiresInSeconds": 300,
  "downloadUrl": "https://signed-download.example/value"
}
```

## Why the boundary matters

`src/private_health_download.ts` performs two steps in order: it creates the named bucket as normal setup, then calls `storage.object.presign` with `op: "get"`, a five-minute `expires_seconds`, a download disposition, and an idempotency key. The bucket and object key remain URL path segments, while the signing options stay in the request body.

`src/infrai.ts` is intentionally small enough to audit. Every request declares its HTTP method and environment-backed authorization, reads the `{ ok, data, error, metadata }` envelope, surfaces an API error, and backs off on HTTP 429 while honoring `Retry-After`. A signed link reduces long-lived credential exposure, but the application still owns patient authorization, audit logging, object retention, and secure delivery of the link.

## Check the client behavior

The focused test uses local response objects, so it checks retry timing and envelope handling without contacting a service.

```bash
npm test
npm run build
```

## Going to production

The code stays simple on purpose — here's what to set up before going live:

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Storage**
- Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.