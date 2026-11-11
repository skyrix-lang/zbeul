// What the site calls itself. The public address is configuration, read by the
// BFF from PUBLIC_URL when the container starts, not baked into the build.
export const site = {
  name: "Zbeul",
  description:
    "The game for afterparties: party games for friends on one phone you pass around, from chill to borderline. Free, no account, plays offline. 18+ only.",
};

/** Pages that should rank: listed in the sitemap. App pages aren't. */
export const PUBLIC_PATHS = ["/"] as const;
