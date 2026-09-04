import { HeadContent, Link, Outlet, Scripts, createRootRoute, useRouter } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Header, Footer } from '../design-system/templates/AppShell'
import { MobileAuthGate } from '../features/auth/MobileAuthGate'
import { OnboardingGate } from '../features/onboarding/OnboardingGate'
import { AppProviders } from '../features/platform/Providers'
import { Toaster } from '../design-system/primitives/sonner'
import appCss from '../styles.css?url'
import compactCss from '../design-system/foundations/compact.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: "Let's Be Friends | Find a Companion" },
      { name: 'description', content: 'Find approved Companions for everyday help, shared activities, and friendly online or in-person experiences.' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preload', href: '/fonts/bricolage-grotesque-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: compactCss },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeBootScript />
        <HeadContent />
      </head>
      <body>
        <AppProviders>
          <OnboardingGate>
            <MobileAuthGate>
              <div className="app-frame web-app-shell">
                <a className="skip-link" href="#main-content">Skip to main content</a>
                <Header />
                <div className="app-frame-main" id="main-content" tabIndex={-1}>
                  {children}
                </div>
                <Footer />
              </div>
            </MobileAuthGate>
          </OnboardingGate>
          <Toaster />
        </AppProviders>
        {import.meta.env.DEV && <TanStackDevtools config={{ position: 'bottom-right' }} plugins={[{ name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> }]} />}
        <Scripts />
      </body>
    </html>
  )
}

function RootNotFound() {
  return (
    <main className="marketing-page">
      <p className="eyebrow">Let&apos;s Be Friends</p>
      <h1 className="text-h1 mt-2">We could not find that page.</h1>
      <p className="lede mt-2">The page may have moved, or you may have followed an old link. Members and Companions can still reach Home, Explore, and bookings from here.</p>
      <div className="mt-5 flex gap-2">
        <Link to="/" className="btn btn-social btn-sm">Go to Home</Link>
        <Link to="/discover" className="btn btn-neutral btn-sm">Explore people</Link>
      </div>
    </main>
  )
}

function RootError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  return (
    <main className="marketing-page">
      <p className="eyebrow">Let&apos;s Be Friends</p>
      <h1 className="text-h1 mt-2">Something did not load.</h1>
      <p className="lede mt-2">Please try again. If this keeps happening, reload the page or return Home and continue from there.</p>
      <div className="mt-5 flex gap-2">
        <button type="button" className="btn btn-self btn-sm" onClick={() => reset()}>Try again</button>
        <button type="button" className="btn btn-neutral btn-sm" onClick={() => router.invalidate()}>Reload content</button>
        <Link to="/" className="btn btn-neutral btn-sm">Go to Home</Link>
      </div>
    </main>
  )
}

function ThemeBootScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var themeKey='lets-be-friends-theme';var saved=localStorage.getItem(themeKey);var dark=saved==='dark'||(!saved&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.dataset.accentTheme='default';}catch(e){document.documentElement.dataset.theme='light';document.documentElement.dataset.accentTheme='default';}})();`,
      }}
    />
  )
}
