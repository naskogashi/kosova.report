import { RETENTION_DAYS } from "../src/lib/retention.js";

// R2 lifecycle rules for citizen evidence. Abandoned uploads under incoming/ expire after a day;
// files of resolved reports are copied to expiring/ and expire 30 days later. The retention job
// deletes them on day 30 itself; these rules are the safety net when it is down.
const unattached = {
  ID: "kosova-drop-unattached-uploads",
  Status: "Enabled",
  Filter: { Prefix: "incoming/" },
  Expiration: { Days: 1 },
};
const resolved = {
  ID: "kosova-expire-resolved-evidence",
  Status: "Enabled",
  Filter: { Prefix: "expiring/" },
  Expiration: { Days: RETENTION_DAYS },
};
export const evidenceRules = [unattached, resolved];
export const publicRules = [resolved];

// PutBucketLifecycleConfiguration replaces every rule on a bucket, so ours are merged into the
// existing ones by ID. A rule of ours without a folder prefix is refused: it would also delete
// branding and news images. Existing rules that expire the whole bucket are reported.
export function mergeRules(existing = [], ours) {
  for (const rule of ours)
    if (!/^[a-z]+\/$/.test(rule.Filter?.Prefix || ""))
      throw new Error(`Rule ${rule.ID} must be limited to one folder prefix`);
  const ids = new Set(ours.map((rule) => rule.ID));
  const kept = existing.filter((rule) => !ids.has(rule.ID));
  const warnings = kept
    .filter((rule) => rule.Expiration && !(rule.Filter?.Prefix ?? rule.Prefix))
    .map((rule) => `Existing rule ${rule.ID || "(unnamed)"} expires objects in the whole bucket`);
  return { rules: [...kept, ...ours], warnings };
}
