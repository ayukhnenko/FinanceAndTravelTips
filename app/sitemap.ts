import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-url";

const ROUTES = [
  "/",
  "/bonds",
  "/credit-card-benefit",
  "/mortgage-sale",
  "/mortgage-conditions-compare",
  "/rent-vs-buy",
  "/compound",
  "/discounting",
  "/loan",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const lastModified = new Date();

  return ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}

