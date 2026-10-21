// An admin deletes a staff account for good. Nobody can delete their own account, and the last
// active admin always stays, so the panel can never be locked out. The account's sessions end
// at once; its report assignments and report checks go with it; news, comments and grouping
// decisions it made stay without a name; the status history keeps its email. A line in
// account_deletions says whose account it was, who deleted it and when.
export class AccountDeletionError extends Error {}

export async function deleteAccount(db, accountId, actor) {
  if (String(accountId) === String(actor.id)) throw new AccountDeletionError("self");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT id,name,email,role FROM staff_accounts WHERE id=? FOR UPDATE", [accountId]);
    const account = rows[0];
    if (!account) throw new AccountDeletionError("missing");
    if (account.role === "owner") {
      const [owners] = await connection.execute(
        "SELECT COUNT(*) AS total FROM staff_accounts WHERE role='owner' AND active=1 AND id<>? FOR UPDATE",
        [account.id],
      );
      if (Number(owners[0].total) < 1) throw new AccountDeletionError("last_owner");
    }
    await connection.execute(
      "INSERT INTO account_deletions (account_name,account_email,account_role,deleted_by,deleted_by_name,deleted_by_email) VALUES (?,?,?,?,?,?)",
      [account.name, account.email, account.role, actor.id, actor.name || actor.email, actor.email],
    );
    await connection.execute("DELETE FROM report_assignments WHERE account_id=?", [account.id]);
    await connection.execute("DELETE FROM report_reviews WHERE account_id=?", [account.id]);
    await connection.execute("UPDATE public_alert_events SET account_id=NULL WHERE account_id=?", [account.id]);
    // Sessions cascade; news authors, comments and grouping decisions are set to NULL.
    await connection.execute("DELETE FROM staff_accounts WHERE id=?", [account.id]);
    await connection.commit();
    return account;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
