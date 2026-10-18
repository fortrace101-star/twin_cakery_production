import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { routes } from "@/router";

// Match routes without rendering: jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  const publicPaths = [
    "/",
    "/about",
    "/blog",
    "/blog/why-twin-cakery-uses-whatsapp-for-orders",
    "/cakes",
    "/contact",
    "/courses",
    "/events",
    "/offers",
    "/order",
  ];

  it.each(publicPaths)("matches a page for %s instead of falling back to 404", (path) => {
    const matches = matchRoutes(routes, path);
    const last = matches?.at(-1);

    expect(matches).not.toBeNull();
    expect(last?.route.path).not.toBe("*");
    expect(last?.route.element).toBeDefined();
  });

  it("falls back to the catch-all for an unknown path", () => {
    const matches = matchRoutes(routes, "/definitely-not-a-page");
    const last = matches?.at(-1);

    expect(last?.route.path).toBe("*");
  });
});
