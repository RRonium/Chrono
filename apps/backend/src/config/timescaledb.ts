export const timescaleConfig = {
  connectionString: process.env.TIMESCALE_URL ?? 'postgresql://chrono:chrono@localhost:5433/chrono'
};
