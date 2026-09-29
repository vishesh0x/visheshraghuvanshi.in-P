import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { CookieNotice } from "../components/site/cookie-notice";
import { siteConfigQuery } from "../lib/cms/queries";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { absoluteUrl } from "../lib/site-url";

function NotFoundComponent() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Page not found - Portfolio OS";

    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const createdMeta = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    const previousRobots = meta.content;
    meta.content = "noindex";

    return () => {
      document.title = previousTitle;
      if (meta) {
        if (createdMeta) meta.remove();
        else meta.content = previousRobots;
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="label-mono text-signal">Error / 404</p>
        <h1 className="mt-4 text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved. Try one of these instead:
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
          <Link
            to="/projects"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            View projects
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(siteConfigQuery());
    return { config };
  },
  head: ({ loaderData }) => {
    const config = loaderData?.config;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "author", content: "Portfolio OS" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: config?.site_title ?? "Portfolio OS" },
        { property: "og:image", content: absoluteUrl("/og-default.png") },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: absoluteUrl("/og-default.png") },
        { name: "theme-color", content: "#141414" },
        ...(config
          ? [
              { title: config.site_title },
              { name: "description", content: config.meta_description },
              { property: "og:description", content: config.meta_description },
            ]
          : []),
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap",
        },
        {
          rel: "stylesheet",
          href: appCss,
        },
        // Browsers pick a favicon from ALL matching <link rel="icon"> tags
        // using their own heuristics (often preferring SVG/high-res PNG
        // regardless of DOM order) - so the static bundled icons below must
        // only be emitted when there's no custom one, or they silently win
        // over whatever was uploaded from the admin dashboard.
        ...(config?.favicon_url
          ? [{ rel: "icon", href: config.favicon_url }]
          : [
              { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
              { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
              { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
              { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
            ]),
        { rel: "apple-touch-icon", sizes: "180x180", href: config?.favicon_url || "/apple-touch-icon.png" },
        { rel: "manifest", href: "/api/manifest" },
      ],
    };
  },

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Rendered per request on the server (and re-rendered on navigation), so every
  // page's canonical points at itself in the initial HTML. It used to be a fixed
  // link to the homepage, telling search engines every page was a duplicate of "/".
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <link rel="canonical" href={absoluteUrl(pathname === "/" ? "/" : pathname.replace(/\/+$/, ""))} />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-signal focus:bg-background focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:tracking-wider focus:text-foreground"
        >
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="bottom-right" />
      <CookieNotice />
    </QueryClientProvider>
  );
}

