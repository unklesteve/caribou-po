/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose environment variables to the server runtime
  env: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  },
};

export default nextConfig;
