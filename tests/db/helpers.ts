// Shared setup for the database tests: a throwaway Postgres database with the
// Supabase stub and every migration applied, plus helpers to act as a user.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

export const adminUrl = process.env.TEST_DATABASE_URL;
const root = path.resolve(__dirname, "../..");

function sqlFile(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

export type TestDb = {
  db: Client;
  asUser<T>(userId: string | null, fn: (c: Client) => Promise<T>): Promise<T>;
  createUser(email: string): Promise<string>;
  close(): Promise<void>;
};

export async function createTestDb(label: string): Promise<TestDb> {
  const dbName = `clarivance_${label}_${process.pid}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(adminUrl!);
  url.pathname = `/${dbName}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();

  await db.query(sqlFile("supabase/tests/supabase_stub.sql"));
  const migrations = readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await db.query(sqlFile(`supabase/migrations/${file}`));
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

  async function close() {
    await db.end();
    const a = new Client({ connectionString: adminUrl });
    await a.connect();
    await a.query(`drop database if exists ${dbName}`);
    await a.end();
  }

  return { db, asUser, createUser, close };
}
