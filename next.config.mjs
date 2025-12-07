/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client', '@prisma/adapter-libsql', 'libsql'],
  },
};

export default nextConfig;
