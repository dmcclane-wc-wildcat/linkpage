/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  PASSPHRASE: string;
  SESSION_SECRET: string;
}
