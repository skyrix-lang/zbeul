import { useEffect } from "react";
import { site } from "@zbeul/core";

// One robots tag for the page, however many components ask for it (a layout
// and the page inside it, for instance): it goes when the last one leaves.
let holders = 0;
let robots: HTMLMetaElement | undefined;

function holdNoindex() {
  if (holders++ === 0) {
    robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
  }
  return () => {
    if (--holders === 0) robots?.remove();
  };
}

/** Asks search engines not to index the page shown, while `active`. */
export function useNoindex(active = true) {
  useEffect(() => (active ? holdNoindex() : undefined), [active]);
}

/**
 * Sets the document title, and asks search engines not to index app screens.
 * Public pages leave `noindex` off. index.html holds the defaults that
 * crawlers see first.
 */
export function usePageMeta({
  title,
  noindex = false,
}: {
  title?: string;
  noindex?: boolean;
}) {
  useEffect(() => {
    document.title = title ? `${title} | ${site.name}` : site.name;
  }, [title]);
  useNoindex(noindex);
}
