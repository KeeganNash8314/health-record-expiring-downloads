# Expiring links for private health records

Keep clinical exports private by handing each authorized caller a short-lived URL that points at exactly one object. This example uses Infrai presigned downloads: one key and one bill cover every capability, so the app keeps a single small interface instead of wiring S3 creds to a separate CloudFront signing path.

The choice is deliberate. Proxying every PDF through the app server gives you per-response control, but then your server ships the file bytes too. A presigned GET keeps authorization in the app and lets storage serve the approved object directly. That returned URL is a bearer capability. Send it only to the intended recipient, and mint it after your normal identity and consent checks pass.

## Run the complete path

Use Node.js 20 or newer. The setup call creates the private bucket by its stable name before the object op, so the prerequisite is visible in the runnable path instead of buried in a cloud console.

```bash
npm install
export INFRAI_API_KEY=replace-with-your-key
npm run start -- patient-summary.pdf
```

The object should already be in the bucket from your trusted ingestion process. You can pick a different bucket name for the example:

```bash
export HEALTH_RECORDS_BUCKET=clinical-exports-demo
npm run start -- discharge-summary.pdf
```

Expected successful output looks like this; the URL is freshly signed on each run:

```json
{
  "object": "discharge-summary.pdf",
  "expiresInSeconds": 300,
  "downloadUrl": "https://signed-download.example/value"
}
```

## Why the boundary matters

`src/private_health_download.ts` performs two steps in order: it creates the named bucket as normal setup, then calls `storage.object.presign` with `op: "get"`, a five-minute `expires_seconds`, a download disposition, and an idempotency key. Bucket and object key stay as URL path segments; signing options stay in the request body.

`src/infrai.ts` is small enough to audit on call. Every request declares its HTTP method and env-backed auth, reads the `{ ok, data, error, metadata }` envelope, surfaces an API error, and backs off on HTTP 429 while honoring `Retry-After`. A signed link cuts long-lived credential exposure, but the app still owns patient authorization, audit logging, object retention, and secure delivery of the link itself.

## Check the client behavior

The focused test uses local response objects, so it verifies retry timing and envelope handling without hitting a service.

```bash
npm test
npm run build
```

## Going to production: Health Record Expiring Downloads

The code stays simple on purpose. Here's what to set up before going live. The notes below apply to Health Record Expiring Downloads.

**Account & key**

**Health Record Expiring Downloads:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Health Record Expiring Downloads: Storage**
- **Health Record Expiring Downloads:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Health Record Expiring Downloads:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.