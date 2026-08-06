import { randomUUID } from "node:crypto";
import { createInfraiClient } from "./infrai.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running this example");

const bucket = process.env.HEALTH_RECORDS_BUCKET ?? "private-health-records-demo";
const objectKey = process.argv[2] ?? "patient-summary.pdf";
const infrai = createInfraiClient(apiKey);

// Bucket creation is an explicit setup operation, identified by its stable name.
await infrai.storage.bucket.create(bucket);

const signedDownload = await infrai.storage.object.presign(bucket, objectKey, {
  op: "get",
  expires_seconds: 300,
  response_disposition: `attachment; filename="${objectKey}"`,
  idempotency_key: randomUUID(),
});

console.log(
  JSON.stringify(
    {
      object: objectKey,
      expiresInSeconds: 300,
      downloadUrl: signedDownload.url,
    },
    null,
    2,
  ),
);
