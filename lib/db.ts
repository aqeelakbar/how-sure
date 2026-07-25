import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

type GlobalWithDb = typeof globalThis & {
  __howSureSql?: SqlClient;
};

const globalWithDb = globalThis as GlobalWithDb;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): SqlClient {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalWithDb.__howSureSql) {
    globalWithDb.__howSureSql = postgres(url, {
      max: process.env.NODE_ENV === "production" ? 3 : 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return globalWithDb.__howSureSql;
}
