// Sets the R2 lifecycle rules for citizen evidence on the evidence and public buckets.
// Shows the rules each bucket would end up with and changes nothing unless run with --apply.
// Bucket settings need an R2 token with Admin Read & Write; the app's Object Read & Write
// token is refused. The production rules were added in the Cloudflare dashboard.
import {
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";
import { storage, bucket, evidenceBucket, publicBucket } from "./runtime.mjs";
import { evidenceRules, publicRules, mergeRules } from "./lifecycle-rules.mjs";

const apply = process.argv.includes("--apply");
try {
  const client = storage({
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  for (const [name, ours] of [
    [evidenceBucket(), evidenceRules],
    [publicBucket(), publicRules],
  ]) {
    if (name === bucket())
      console.log(`WARNING: ${name} is also R2_BUCKET, which holds branding and news images.`);
    const existing = await client
      .send(new GetBucketLifecycleConfigurationCommand({ Bucket: name }))
      .then(
        (result) => result.Rules || [],
        (error) => {
          if (error.name === "NoSuchLifecycleConfiguration") return [];
          throw error;
        },
      );
    const { rules, warnings } = mergeRules(existing, ours);
    for (const warning of warnings) console.log(`WARNING (${name}): ${warning}`);
    console.log(`${name}:`);
    for (const rule of rules)
      console.log(
        `  ${rule.ID || "(unnamed)"}: ${rule.Filter?.Prefix ?? rule.Prefix ?? "(whole bucket)"} ${rule.Expiration ? `deleted after ${rule.Expiration.Days} days` : "no expiry"}`,
      );
    if (apply) {
      await client.send(
        new PutBucketLifecycleConfigurationCommand({ Bucket: name, LifecycleConfiguration: { Rules: rules } }),
      );
      console.log(`  Applied.`);
    }
  }
  if (!apply) console.log("Nothing changed. Run again with --apply to set these rules.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
