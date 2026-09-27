import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next 16 otherwise writes AGENTS.md and CLAUDE.md into the repo on dev start.
  agentRules: false,
}

export default nextConfig
