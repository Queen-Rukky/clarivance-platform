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

  it("rejects adding someone who is already a member", async () => {
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

  it("invites an unknown email and adds them when they sign in", async () => {
    const result = await asUser(alice, async (c) =>
      (await c.query("select clarivance.add_member_by_email($1, ' Dave@Example.com ', 'staff') as r", [aliceBiz])).rows[0].r,
    );
    expect(result).toBe("invited");

    const invites = await asUser(alice, async (c) =>
      (await c.query("select email, role from clarivance.invites where business_id = $1", [aliceBiz])).rows,
    );
    expect(invites).toEqual([{ email: "dave@example.com", role: "staff" }]);
    const bobSees = await asUser(bob, async (c) => (await c.query("select * from clarivance.invites")).rowCount);
    expect(bobSees).toBe(0);

    const dave = await createUser("dave@example.com");
    const accepted = await asUser(dave, async (c) => (await c.query("select clarivance.accept_my_invites() as n")).rows[0].n);
    expect(accepted).toBe(1);
    const role = await asUser(dave, async (c) =>
      (await c.query("select role from clarivance.business_members where business_id = $1 and user_id = $2", [aliceBiz, dave])).rows,
    );
    expect(role).toEqual([{ role: "staff" }]);
    const left = await asUser(alice, async (c) => (await c.query("select * from clarivance.invites")).rowCount);
    expect(left).toBe(0);
  });

  it("does not accept invites for an unconfirmed email", async () => {
    await asUser(alice, (c) => c.query("select clarivance.add_member_by_email($1, 'eve@example.com', 'admin')", [aliceBiz]));
    const { rows } = await db.query(
      "insert into auth.users (email, email_confirmed_at) values ('eve@example.com', null) returning id",
    );
    const accepted = await asUser(rows[0].id, async (c) => (await c.query("select clarivance.accept_my_invites() as n")).rows[0].n);
    expect(accepted).toBe(0);
  });

  it("only lets owners and admins cancel invites", async () => {
    const inviteId = await asUser(alice, async (c) =>
      (await c.query("select id from clarivance.invites where email = 'eve@example.com'")).rows[0].id,
    );
    await expect(asUser(bob, (c) => c.query("select clarivance.cancel_invite($1)", [inviteId]))).rejects.toThrow(/not allowed/);
    await asUser(alice, (c) => c.query("select clarivance.cancel_invite($1)", [inviteId]));
    const left = await asUser(alice, async (c) => (await c.query("select * from clarivance.invites")).rowCount);
    expect(left).toBe(0);
  });

  it("keeps the knowledge base private to each business and logs changes", async () => {
    const serviceId = await asUser(alice, async (c) => {
      await c.query("insert into clarivance.business_profiles (business_id, about) values ($1, 'We help firms grow')", [aliceBiz]);
      return (
        await c.query(
          "insert into clarivance.services (business_id, name, price_type, price_min, currency) values ($1, 'Strategy session', 'fixed', 50000, 'NGN') returning id",
          [aliceBiz],
        )
      ).rows[0].id;
    });

    const bobView = await asUser(bob, async (c) => ({
      services: (await c.query("select * from clarivance.services")).rowCount,
      profiles: (await c.query("select * from clarivance.business_profiles")).rowCount,
      updated: (await c.query("update clarivance.services set name = 'x' where id = $1", [serviceId])).rowCount,
      deleted: (await c.query("delete from clarivance.services where id = $1", [serviceId])).rowCount,
    }));
    expect(bobView).toEqual({ services: 0, profiles: 0, updated: 0, deleted: 0 });

    await expect(
      asUser(bob, (c) => c.query("insert into clarivance.services (business_id, name) values ($1, 'Fake')", [aliceBiz])),
    ).rejects.toThrow(/row-level security/);
    await expect(asUser(bob, (c) => c.query("select clarivance.approved_knowledge($1)", [aliceBiz]))).rejects.toThrow(
      /not allowed/,
    );

    const actions = await asUser(alice, async (c) =>
      (
        await c.query(
          "select action from clarivance.activity_log where business_id = $1 and entity_type in ('service', 'profile') order by id",
          [aliceBiz],
        )
      ).rows.map((r) => r.action),
    );
    expect(actions).toEqual(["profile.created", "service.created"]);
  });

  it("does not let staff edit the knowledge base", async () => {
    const dave = (await db.query("select id from auth.users where email = 'dave@example.com'")).rows[0].id;
    await expect(
      asUser(dave, (c) => c.query("insert into clarivance.knowledge_items (business_id, question, answer) values ($1, 'Q?', 'A')", [aliceBiz])),
    ).rejects.toThrow(/row-level security/);
    const updated = await asUser(dave, async (c) =>
      (await c.query("update clarivance.services set status = 'approved' where business_id = $1", [aliceBiz])).rowCount,
    );
    expect(updated).toBe(0);
  });

  it("gives the agent only approved services and FAQs", async () => {
    await asUser(alice, async (c) => {
      await c.query(
        "insert into clarivance.knowledge_items (business_id, question, answer, status) values ($1, 'Where are you?', 'Lagos', 'approved'), ($1, 'Secret?', 'Draft only', 'draft')",
        [aliceBiz],
      );
    });
    let kb = await asUser(alice, async (c) => (await c.query("select clarivance.approved_knowledge($1) as kb", [aliceBiz])).rows[0].kb);
    expect(kb.business.name).toBeTruthy();
    expect(kb.profile.about).toBe("We help firms grow");
    expect(kb.services).toEqual([]);
    expect(kb.faqs).toEqual([{ question: "Where are you?", answer: "Lagos" }]);

    await asUser(alice, (c) => c.query("update clarivance.services set status = 'approved' where business_id = $1", [aliceBiz]));
    kb = await asUser(alice, async (c) => (await c.query("select clarivance.approved_knowledge($1) as kb", [aliceBiz])).rows[0].kb);
    expect(kb.services).toMatchObject([{ name: "Strategy session", price_type: "fixed", currency: "NGN" }]);

    const approvedLog = await asUser(alice, async (c) =>
      (await c.query("select count(*)::int as n from clarivance.activity_log where action = 'service.approved'")).rows[0].n,
    );
    expect(approvedLog).toBe(1);
  });

  it("rejects prices that don't match the price type", async () => {
    await expect(
      asUser(alice, (c) =>
        c.query("insert into clarivance.services (business_id, name, price_type, price_min) values ($1, 'Bad', 'ask_owner', 100)", [aliceBiz]),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      asUser(alice, (c) =>
        c.query(
          "insert into clarivance.services (business_id, name, price_type, price_min, price_max) values ($1, 'Bad', 'range', 500, 100)",
          [aliceBiz],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
