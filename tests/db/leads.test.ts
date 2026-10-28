// Leads, outreach drafts, sample data, plan limits and deleting a business.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminUrl, createTestDb, type TestDb } from "./helpers";

describe.skipIf(!adminUrl)("clarivance leads", () => {
  let t: TestDb;
  let alice: string;
  let bob: string;
  let staff: string;
  let aliceBiz: string;
  let bobBiz: string;

  const addLead = (uid: string, biz: string, fields: Record<string, unknown>) =>
    t.asUser(uid, async (c) => {
      const cols = Object.keys(fields);
      const { rows } = await c.query(
        `insert into clarivance.leads (business_id, ${cols.join(", ")}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}) returning id`,
        [biz, ...Object.values(fields)],
      );
      return rows[0].id as string;
    });

  beforeAll(async () => {
    t = await createTestDb("leads");
    alice = await t.createUser("alice@example.com");
    bob = await t.createUser("bob@example.com");
    staff = await t.createUser("staff@example.com");
    aliceBiz = await t.asUser(alice, async (c) => (await c.query("select clarivance.create_business('Alice Co') as id")).rows[0].id);
    bobBiz = await t.asUser(bob, async (c) => (await c.query("select clarivance.create_business('Bob Co') as id")).rows[0].id);
    await t.asUser(alice, (c) => c.query("select clarivance.add_member_by_email($1, 'staff@example.com', 'staff')", [aliceBiz]));
  });

  afterAll(async () => {
    if (t) await t.close();
  });

  it("lets staff add and work leads, records history and logs it", async () => {
    const id = await addLead(staff, aliceBiz, { company: "Acme Clinic", email: "ops@acme.test" });
    await t.asUser(staff, (c) => c.query("update clarivance.leads set status = 'qualified', notes = 'Keen' where id = $1", [id]));

    const lead = await t.asUser(alice, async (c) =>
      (await c.query("select created_by, status, is_sample from clarivance.leads where id = $1", [id])).rows[0],
    );
    expect(lead).toEqual({ created_by: staff, status: "qualified", is_sample: false });

    const history = await t.asUser(alice, async (c) =>
      (await c.query("select status from clarivance.lead_stage_history where lead_id = $1 order by id", [id])).rows.map((r) => r.status),
    );
    expect(history).toEqual(["new", "qualified"]);

    const log = await t.asUser(alice, async (c) =>
      (await c.query("select action from clarivance.activity_log where entity_id = $1 order by id", [id])).rows.map((r) => r.action),
    );
    expect(log).toEqual(["lead.created", "lead.status_changed"]);
  });

  it("keeps leads private to each business", async () => {
    const id = await addLead(alice, aliceBiz, { company: "Private Ltd" });
    const seen = await t.asUser(bob, async (c) => ({
      leads: (await c.query("select * from clarivance.leads where id = $1", [id])).rowCount,
      history: (await c.query("select * from clarivance.lead_stage_history where lead_id = $1", [id])).rowCount,
      updated: (await c.query("update clarivance.leads set notes = 'x' where id = $1", [id])).rowCount,
    }));
    expect(seen).toEqual({ leads: 0, history: 0, updated: 0 });
    await expect(addLead(bob, aliceBiz, { company: "Sneaky" })).rejects.toThrow(/row-level security/);
  });

  it("stops staff deleting leads and clients faking sample data or the creator", async () => {
    const id = await addLead(alice, aliceBiz, { company: "Keep Me" });
    const deleted = await t.asUser(staff, async (c) => (await c.query("delete from clarivance.leads where id = $1", [id])).rowCount);
    expect(deleted).toBe(0);
    await expect(addLead(alice, aliceBiz, { company: "Fake", source: "sample" })).rejects.toThrow(/check constraint/);
    await expect(
      t.asUser(alice, (c) => c.query("update clarivance.leads set created_by = $2 where id = $1", [id, bob])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(alice, (c) => c.query("update clarivance.businesses set plan = 'growth' where id = $1", [aliceBiz])),
    ).rejects.toThrow(/permission denied/);
  });

  it("requires at least a name, company, email or phone", async () => {
    await expect(addLead(alice, aliceBiz, { industry: "Retail" })).rejects.toThrow(/check constraint/);
  });

  it("finds possible duplicates by email, phone, website and company", async () => {
    const a = await addLead(alice, aliceBiz, { company: "Dup One", email: "Same@Dup.test", phone: "+234 801 234 5678", website: "https://www.dup.test/about" });
    await addLead(alice, aliceBiz, { contact_name: "Other", email: "same@dup.test" });
    await addLead(alice, aliceBiz, { contact_name: "Phone match", phone: "08012345678" });
    await addLead(alice, aliceBiz, { contact_name: "Site match", website: "dup.test" });
    await addLead(bob, bobBiz, { company: "Dup One", email: "same@dup.test" });

    const dups = await t.asUser(alice, async (c) =>
      (await c.query("select matched_on from clarivance.lead_duplicates($1) order by matched_on", [a])).rows.map((r) => r.matched_on),
    );
    expect(dups).toEqual(["email", "phone", "website"]);
  });

  it("loads and removes sample leads, kept apart from real ones", async () => {
    await expect(t.asUser(staff, (c) => c.query("select clarivance.load_sample_leads($1)", [aliceBiz]))).rejects.toThrow(/not allowed/);
    const n = await t.asUser(alice, async (c) => (await c.query("select clarivance.load_sample_leads($1) as n", [aliceBiz])).rows[0].n);
    expect(n).toBe(6);
    await expect(t.asUser(alice, (c) => c.query("select clarivance.load_sample_leads($1)", [aliceBiz]))).rejects.toThrow(/already loaded/);

    const samples = await t.asUser(alice, async (c) =>
      (await c.query("select count(*)::int as n from clarivance.leads where business_id = $1 and is_sample and email like '%example.com'", [aliceBiz])).rows[0].n,
    );
    expect(samples).toBe(6);
    const removed = await t.asUser(alice, async (c) => (await c.query("select clarivance.remove_sample_leads($1) as n", [aliceBiz])).rows[0].n);
    expect(removed).toBe(6);
  });

  it("only lets drafts point at the business's own leads", async () => {
    const mine = await addLead(alice, aliceBiz, { company: "Draft Target" });
    const theirs = await addLead(bob, bobBiz, { company: "Bob Lead" });
    await t.asUser(alice, (c) =>
      c.query("insert into clarivance.outreach_drafts (business_id, lead_id, channel, body) values ($1, $2, 'email', 'Hello')", [aliceBiz, mine]),
    );
    await expect(
      t.asUser(alice, (c) =>
        c.query("insert into clarivance.outreach_drafts (business_id, lead_id, channel, body) values ($1, $2, 'email', 'Hi')", [aliceBiz, theirs]),
      ),
    ).rejects.toThrow(/row-level security/);
    const bobSees = await t.asUser(bob, async (c) => (await c.query("select * from clarivance.outreach_drafts")).rowCount);
    expect(bobSees).toBe(0);
  });

  it("enforces the plan's lead limit", async () => {
    await t.db.query("update clarivance.businesses set plan = 'cancelled' where id = $1", [bobBiz]);
    await expect(addLead(bob, bobBiz, { company: "Over limit" })).rejects.toThrow(/lead limit/);
    await t.db.query("update clarivance.businesses set plan = 'trial' where id = $1", [bobBiz]);
  });

  it("lets only an owner delete a business, with the exact name", async () => {
    await expect(t.asUser(staff, (c) => c.query("select clarivance.delete_business($1, 'Alice Co')", [aliceBiz]))).rejects.toThrow(/not allowed/);
    await expect(t.asUser(alice, (c) => c.query("select clarivance.delete_business($1, 'alice co')", [aliceBiz]))).rejects.toThrow(/does not match/);

    await t.asUser(alice, async (c) => {
      await c.query("insert into clarivance.services (business_id, name) values ($1, 'A service')", [aliceBiz]);
      await c.query("select clarivance.delete_business($1, 'Alice Co')", [aliceBiz]);
    });
    const left = await t.db.query("select (select count(*) from clarivance.leads where business_id = $1)::int as leads, (select count(*) from clarivance.businesses where id = $1)::int as biz", [aliceBiz]);
    expect(left.rows[0]).toEqual({ leads: 0, biz: 0 });
  });
});
