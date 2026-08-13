const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // monorepo: standalone inclui apps/web/server.js a partir da raiz do repo
  outputFileTracingRoot: path.join(__dirname, "../.."),
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
