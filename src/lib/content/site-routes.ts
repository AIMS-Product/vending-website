/**
 * Static top-level routes, shared by src/app/sitemap.ts and
 * lib/chatbot/site-knowledge.ts. Kept in its own zero-dependency module so
 * importing the route list (e.g. for the chatbot's route map, built on every
 * chat request) never pulls in sitemap.ts's DB-touching service imports.
 */
export const staticRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/case-studies", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions", priority: 0.8, changeFrequency: "monthly" },
  { path: "/process", priority: 0.8, changeFrequency: "monthly" },
  { path: "/news", priority: 0.7, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
] as const;
