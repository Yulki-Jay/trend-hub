/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: { serverComponentsExternalPackages: ['better-sqlite3'], instrumentationHook: true },
};
module.exports = nextConfig;
