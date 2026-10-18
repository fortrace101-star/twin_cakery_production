import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation, useRouteError } from "react-router-dom";
import { Header } from "./components/layout";
import { BlogListPage } from "./pages/blog-list";
import { BlogNewPage } from "./pages/blog-new";
import { LoginPage } from "./pages/login";
import { getToken } from "./lib/blog-api";

const nav: [string, string][] = [
  ["/", "Blog list"],
  ["/new", "Write a post"],
];

/** Gate the management pages: no token -> the login screen. */
function RequireAuth() {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Header links={nav} />
        <main>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<BlogListPage />} />
              <Route path="/new" element={<BlogNewPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="empty-state">
      <h1>Not found</h1>
      <p>The blog dashboard page you are looking for does not exist.</p>
      <Link to="/">Back to blog list</Link>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="empty-state">
      <h1>Something went wrong</h1>
      <p>Please try again or head back to the blog list.</p>
      <Link to="/">Back to blog list</Link>
    </div>
  );
}
