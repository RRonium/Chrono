// Static export so the dashboard can be hosted on GitHub Pages.
// NEXT_PUBLIC_BASE_PATH is "/Chrono" on a github.io project URL and empty on a custom domain.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

module.exports = nextConfig;
