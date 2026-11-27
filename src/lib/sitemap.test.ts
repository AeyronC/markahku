import { describe, expect, it } from "vitest";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { sitemapStaticPaths, sitemapXML } from "./sitemap";

describe("public sitemap", () => {
  it("includes public pages but not private descendants or redirects", () => {
    const root = createRootRoute({ staticData: { sitemap: false } });
    const home = createRoute({ getParentRoute: () => root, path: "/", staticData: { sitemap: true } });
    const privacy = createRoute({ getParentRoute: () => root, path: "privacy", staticData: { sitemap: true } });
    const login = createRoute({ getParentRoute: () => root, path: "login", staticData: { sitemap: false } });
    const privateLayout = createRoute({ getParentRoute: () => root, id: "private", staticData: { sitemap: "exclude-subtree" } });
    const dashboard = createRoute({ getParentRoute: () => privateLayout, path: "dashboard", staticData: { sitemap: true } });
    const router = createRouter({ routeTree: root.addChildren([home, privacy, login, privateLayout.addChildren([dashboard])]) });
    expect(sitemapStaticPaths(router)).toEqual(["/", "/privacy"]);
  });
  it("uses the published origin without fabricated modification dates", () => {
    const xml = sitemapXML("https://markahku.lovable.app", [{ path: "/" }, { path: "/privacy" }]);
    expect(xml).toContain("<loc>https://markahku.lovable.app/</loc>");
    expect(xml).toContain("<loc>https://markahku.lovable.app/privacy</loc>");
    expect(xml).not.toContain("<lastmod>");
  });
  it("rejects paths that escape the public origin", () => {
    expect(() => sitemapXML("https://markahku.lovable.app", [{ path: "//other.example/" }])).toThrow("Invalid sitemap path");
  });
});
