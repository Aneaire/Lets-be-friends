import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Header, Footer } from '../components/AppShell'
import { OnboardingGate } from '../components/OnboardingGate'
import { AppProviders } from '../components/Providers'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: "Let's Be Friends | Trust-first friend hosting" },
      { name: 'description', content: 'Discover approved Friend Hosts for safe online and local shared experiences.' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preload', href: '/fonts/bricolage-grotesque-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
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
            <div className="app-frame web-app-shell">
              <a className="skip-link" href="#main-content">Skip to main content</a>
              <Header />
              <div className="app-frame-main" id="main-content" tabIndex={-1}>
                {children}
              </div>
              <Footer />
            </div>
          </OnboardingGate>
        </AppProviders>
        {import.meta.env.DEV && <TanStackDevtools config={{ position: 'bottom-right' }} plugins={[{ name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> }]} />}
        <Scripts />
      </body>
    </html>
  )
}

function ThemeBootScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var key='lets-be-friends-theme';var saved=localStorage.getItem(key);var dark=saved==='dark'||(!saved&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.theme=dark?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`,
      }}
    />
  )
}
