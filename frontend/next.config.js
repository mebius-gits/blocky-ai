/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 允許連接到後端 API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
