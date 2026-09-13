export const postgresConfig = {
  connectionString: process.env.POSTGRES_URL ?? 'postgresql://chrono:chrono@localhost:5432/chrono'
};
