import type { AuthConfig } from 'convex/server'

const clerkDomain = process.env.CLERK_JWT_ISSUER_DOMAIN ?? process.env.CLERK_ISSUER

export default {
  providers: [
    {
      domain: clerkDomain ?? 'https://example.clerk.accounts.dev',
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig
