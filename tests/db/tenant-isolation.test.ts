// Runs the real migrations against a throwaway Postgres database and checks
// tenant isolation as the `authenticated` role. Skipped unless
// TEST_DATABASE_URL points at a Postgres server we may create databases on.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const adminUrl = process.env.TEST_DATABASE_URL;
const root = path.resolve(__dirname, "../..");
const dbName = `clarivance_test_${process.pid}`;

let db: Client;

function sqlFile(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

async function asUser<T>(userId: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role: "authenticated" } : {}),
    ]);
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
}

async function createUser(email: string): Promise<string> {
  const { rows } = await db.query("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id;
}

describe.skipIf(!adminUrl)("clarivance tenant isolation", () => {
  let alice: string;
  let bob: string;
  let carol: string;
  let aliceBiz: string;
  let bobBiz: string;

  beforeAll(async () => {
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName}`);
    await admin.query(`create database ${dbName}`);
    await admin.end();

    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();

    await db.query(sqlFile("supabase/tests/supabase_stub.sql"));
    const migrations = readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
    for (const file of migrations) {
      await db.query(sqlFile(`supabase/migrations/${file}`));
    }

    alice = await createUser("alice@example.com");
    bob = await createUser("bob@example.com");
    carol = await createUser("carol@example.com");

    aliceBiz = await asUser(alice, async (c) =>
      (await c.query("select clarivance.create_business('Clarivance') as id")).rows[0].id,
    );
    bobBiz = await asUser(bob, async (c) =>
      (await c.query("select clarivance.create_business('Bob Plumbing') as id")).rows[0].id,
    );
  });

  afterAll(async () => {
    if (!db) return;
    await db.end();
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName}`);
    await admin.end();
  });

  it("makes the creator the owner and logs it", async () => {
    const rows = await asUser(alice, async (c) =>
      (await c.query("select role from clarivance.business_members where business_id = $1", [aliceBiz])).rows,
    );
    expect(rows).toEqual([{ role: "owner" }]);

    const log = await asUser(alice, async (c) =>
      (await c.query("select action, actor_user_id from clarivance.activity_log where business_id = $1", [aliceBiz])).rows,
    );
    expect(log).toEqual([{ action: "business.created", actor_user_id: alice }]);
  });

  it("does not let one tenant read another tenant's rows", async () => {
    const result = await asUser(bob, async (c) => ({
      businesses: (await c.query("select id from clarivance.businesses")).rows.map((r) => r.id),
      members: (await c.query("select * from clarivance.business_members where business_id = $1", [aliceBiz])).rowCount,
      log: (await c.query("select * from clarivance.activity_log where business_id = $1", [aliceBiz])).rowCount,
    }));
    expect(result.businesses).toEqual([bobBiz]);
    expect(result.members).toBe(0);
    expect(result.log).toBe(0);
  });

  it("does not let a tenant update another tenant's business", async () => {
    const updated = await asUser(bob, async (c) =>
      (await c.query("update clarivance.businesses set name = 'hacked' where id = $1", [aliceBiz])).rowCount,
    );
    expect(updated).toBe(0);
  });

  it("blocks direct writes to memberships and the activity log", async () => {
    await expect(
      asUser(bob, (c) =>
        c.query("insert into clarivance.business_members (business_id, user_id, role) values ($1, $2, 'owner')", [aliceBiz, bob]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(alice, (c) => c.query("delete from clarivance.activity_log where business_id = $1", [aliceBiz])),
    ).rejects.toThrow(/permission denied/);
  });

  it("blocks non-members from member RPCs and logging", async () => {
    await expect(
      asUser(bob, (c) => c.query("select clarivance.add_member_by_email($1, 'bob@example.com', 'owner')", [aliceBiz])),
    ).rejects.toThrow(/not allowed/);
    await expect(asUser(bob, (c) => c.query("select * from clarivance.list_members($1)", [aliceBiz]))).rejects.toThrow(
      /not allowed/,
    );
    await expect(
      asUser(bob, (c) => c.query("select clarivance.log_activity($1, 'fake.action')", [aliceBiz])),
    ).rejects.toThrow(/not allowed/);
  });

  it("rejects calls with no signed-in user", async () => {
    await expect(asUser(null, (c) => c.query("select clarivance.create_business('Nobody Ltd')"))).rejects.toThrow(
      /not authenticated/,
    );
  });

  it("lets an owner add staff, who can then read but not manage", async () => {
    await asUser(alice, (c) => c.query("select clarivance.add_member_by_email($1, 'CAROL@example.com', 'staff')", [aliceBiz]));

    const members = await asUser(carol, async (c) =>
      (await c.query("select email, role from clarivance.list_members($1)", [aliceBiz])).rows,
    );
    expect(members).toEqual([
      { email: "alice@example.com", role: "owner" },
      { email: "carol@example.com", role: "staff" },
    ]);

    await expect(
      asUser(carol, (c) => c.query("select clarivance.add_member_by_email($1, 'bob@example.com', 'staff')", [aliceBiz])),
    ).rejects.toThrow(/not allowed/);
    const renamed = await asUser(carol, async (c) =>
      (await c.query("update clarivance.businesses set name = 'Carol Co' where id = $1", [aliceBiz])).rowCount,
    );
    expect(renamed).toBe(0);
  });

  it("keeps at least one owner", async () => {
    await expect(
      asUser(alice, (c) => c.query("select clarivance.update_member_role($1, $2, 'admin')", [aliceBiz, alice])),
    ).rejects.toThrow(/at least one owner/);
    await expect(asUser(alice, (c) => c.query("select clarivance.remove_member($1, $2)", [aliceBiz, alice]))).rejects.toThrow(
      /at least one owner/,
    );
  });

  it("stops an admin from promoting anyone to owner", async () => {
    await asUser(alice, (c) => c.query("select clarivance.update_member_role($1, $2, 'admin')", [aliceBiz, carol]));
    await expect(
      asUser(carol, (c) => c.query("select clarivance.update_member_role($1, $2, 'owner')", [aliceBiz, carol])),
    ).rejects.toThrow(/only an owner/);
  });

  it("gives a clear error for unknown emails and duplicates", async () => {
    await expect(
      asUser(alice, (c) => c.query("select clarivance.add_member_by_email($1, 'nobody@example.com', 'staff')", [aliceBiz])),
    ).rejects.toThrow(/sign up first/);
    await expect(
      asUser(alice, (c) => c.query("select clarivance.add_member_by_email($1, 'carol@example.com', 'staff')", [aliceBiz])),
    ).rejects.toThrow(/already a member/);
  });

  it("hides the clarivance schema from anonymous users", async () => {
    await db.query("begin");
    try {
      await db.query("set local role anon");
      await expect(db.query("select * from clarivance.businesses")).rejects.toThrow(/permission denied/);
    } finally {
      await db.query("rollback");
    }
  });
});
