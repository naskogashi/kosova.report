import { S3Client } from "@aws-sdk/client-s3";
import { required } from "./db";
export function r2() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}
export const bucketName = () => process.env.R2_BUCKET || "kosova-report-images";
// Citizen evidence (private) and staff-published copies, both under the 30-day retention rules.
export const evidenceBucket = () => process.env.R2_EVIDENCE_BUCKET || "kosova-evidence";
export const publicBucket = () => process.env.R2_PUBLIC_BUCKET || "kosova-public";
