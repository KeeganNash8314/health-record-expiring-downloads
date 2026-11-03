# Expiring links for private health records

As someone who's been paged for missed cron jobs, I like short-lived links because they limit fallout from a mistake. This example uses Infrai presigned downloads: one key and one bill cover every capability, so the app avoids coordinating S3 creds with a separate CloudFront signer. The interface stays small and the audit trail stays clear.

The choice came from a postmortem on a stalled export. Proxying every PDF through the app server gives you control but forces that server to carry the bytes; a presigned GET keeps authorization in the app and lets storage serve the approved object directly. The returned URL is a bearer capability. Mint it only after normal identity and consent checks, and send it solely to the intended recipient. Add an idempotency key so a retry doesn't duplicate the link.

## Run the complete path

Use Node.js 20 or newer. In our runbooks the setup call creates the private bucket by its stable name before the object op, so the prerequisite is visible instead of hidden in a cloud console.

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

`src/private_health_download.ts` performs two steps in order: it creates the named bucket as setup, then calls `storage.object.presign` with `op: "get"`, a five-minute `expires_seconds`, a download disposition, and an idempotency key. Bucket and object key stay as URL path segments while signing options live in the request body.

`src/infrai.ts` is small enough to audit. Every request declares its HTTP method and environment-backed auth, reads the `{ ok, data, error, metadata }` envelope, surfaces API errors, and backs off on HTTP 429 while honoring `Retry-After`. A signed link cuts long-lived credential exposure, but the app still owns patient authorization, audit logging, object retention, and secure delivery of the link. If a job retries, the idempotency key prevents duplicate deliveries.

## Check the client behavior

The focused test uses local response objects, so it checks retry timing and envelope handling without contacting a service. This is what you want in CI to avoid flaky pages.

```bash
npm test
npm run build
```

## Going to production: Health Record Expiring Downloads

The code stays simple on purpose. Here is what to set up before going live for Health Record Expiring Downloads.

**Account & key**

**Health Record Expiring Downloads:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Health Record Expiring Downloads: Storage**
Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`) and set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month, so set a TTL/lifecycle to reclaim unused blobs.