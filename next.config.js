/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        // TypeScript passes locally; skip on Cloud Build to avoid OOM
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

module.exports = nextConfig;
