import { randomPassword, hashPassword } from "../src/lib/admin-auth.js";
export async function bootstrapOwner(
  connection,
  email,
  { reset = false } = {},
) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Use a valid administrator email.");
  await connection.beginTransaction();
  try {
    const [owners] = await connection.execute(
      "SELECT id,email FROM staff_accounts WHERE role='owner' FOR UPDATE",
    );
    if (owners.length && !reset) {
      await connection.commit();
      return { existing: true, email: owners[0].email };
    }
    if (owners.length && owners[0].email.toLowerCase() !== email.toLowerCase())
      throw new Error("Reset must name the existing owner email.");
    const password = randomPassword();
    let id;
    if (owners.length) {
      id = owners[0].id;
      await connection.execute(
        "UPDATE staff_accounts SET password_hash=?,active=1,must_change_password=1,temporary_expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR) WHERE id=?",
        [hashPassword(password), id],
      );
      await connection.execute(
        "DELETE FROM staff_sessions WHERE account_id=?",
        [id],
      );
    } else {
      const [result] = await connection.execute(
        "INSERT INTO staff_accounts (email,name,role,password_hash,must_change_password,temporary_expires_at) VALUES (?,?,'owner',?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))",
        [email.toLowerCase(), "Platform administrator", hashPassword(password)],
      );
      id = result.insertId;
    }
    await connection.commit();
    return { email: email.toLowerCase(), password };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
