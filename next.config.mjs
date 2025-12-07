/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure server components can access runtime env vars
    serverComponentsExternalPackages: ['@libsql/client'],
  },
};

export default nextConfig;
