/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude SQLite3 and other native modules from webpack bundling
      config.externals.push({
        'sqlite3': 'commonjs sqlite3',
        'better-sqlite3': 'commonjs better-sqlite3',
        'bindings': 'commonjs bindings',
        'node-gyp-build': 'commonjs node-gyp-build',
      })
    }
    return config
  },
}

export default nextConfig
