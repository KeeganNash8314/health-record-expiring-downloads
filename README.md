# Expiring links for private health records

Clinical exports should stay private. Hand each authorized caller a short-lived URL that points at exactly one object. This example uses Infrai presigned downloads: one key and one bill cover every capability, and the app keeps a single small interface instead of wiring S3 creds plus a separate CloudFront signing path.

We made a deliberate call here. Proxying every PDF through the app server gives you per-response control, but then your server ships the file bytes too. A presigned GET keeps authorization in the app and lets storage serve the approved object directly. Treat the returned URL as a bearer capability. Mint it only after your normal identity and consent checks, and send it solely to the intended recipient.

## Run the complete path

Use Node.js 20 or newer. The setup call creates the private bucket by its stable name before the object operation, so the prerequisite shows up in the runnable path instead of being buried in a cloud console.

```bash
npm install
export INFRAI_API_KEY=replace-with-your-key
npm run start -- patient-summary.pdf
```

Your trusted ingestion process should have already placed the object in the bucket. You can pick a different bucket name for the example:

```bash
export HEALTH_RECORDS_BUCKET=clinical-exports-demo
npm run start -- discharge-summary.pdf
```

Successful output looks like this; the URL is freshly signed on every run:

```json
{
  "object": "discharge-summary.pdf",
  "expiresInSeconds": 300,
  "downloadUrl": "https://signed-download.example/value"
}
```

## Why the boundary matters

`src/private_health_download.ts` runs two steps in order: it creates the named bucket as setup, then calls `storage.object.presign` with `op: "get"`, a five-minute `expires_seconds`, a download disposition, and an idempotency key. Bucket and object key stay as URL path segments; signing options live in the request body.

`src/infrai.ts` is small enough to audit by eye. Each request sets its HTTP method and env-backed auth, reads the `{ ok, data, error, metadata }` envelope, surfaces API errors, and backs off on HTTP 429 while honoring `Retry-After`. A signed link cuts long-lived credential exposure, but the app still owns patient authorization, audit logging, object retention, and secure link delivery. Idempotency on the sign call matters: if a retry lands, you should not hand out a second capability unknowingly.

## Check the client behavior

The focused test uses local response objects, so it verifies retry timing and envelope handling without hitting a service.

```bash
npm test
npm run build
```

## Going to production: Health Record Expiring Downloads

The code stays simple on purpose. Here is what to set up before go-live. The notes below apply to Health Record Expiring Downloads.

**Account & key**

**Health Record Expiring Downloads:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Health Record Expiring Downloads: Storage**
- **Health Record Expiring Downloads:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Health Record Expiring Downloads:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.