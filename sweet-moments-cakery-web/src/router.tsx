import {
  createBrowserRouter,
  isRouteErrorResponse,
  Link,
  Outlet,
  ScrollRestoration,
  useRouteError,
  type RouteObject,
} from "react-router-dom";

import { SiteFooter, SiteHeader } from "@/components/cakery/site-shell";
import { AboutPage } from "@/pages/about";
import { BlogPage } from "@/pages/blog";
import { BlogPostPage } from "@/pages/blog/blog-post";
import { CakesPage } from "@/pages/cakes";
import { ContactPage } from "@/pages/contact";
import { CoursesPage } from "@/pages/courses";
import { EventsPage } from "@/pages/events";
import { HomePage } from "@/pages/home";
import { NotFoundPage } from "@/pages/not-found";
import { OffersPage } from "@/pages/offers";
import { OrderPage } from "@/pages/order";

function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  console.error(error);
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Something went wrong on our end. You can try refreshing or head back home.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <AboutPage /> },
      { path: "blog", element: <BlogPage /> },
      { path: "blog/:slug", element: <BlogPostPage /> },
      { path: "cakes", element: <CakesPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "courses", element: <CoursesPage /> },
      { path: "events", element: <EventsPage /> },
      { path: "offers", element: <OffersPage /> },
      { path: "order", element: <OrderPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
