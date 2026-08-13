/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://waba.draxsistemas.com.br https://*.draxsistemas.com.br",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
