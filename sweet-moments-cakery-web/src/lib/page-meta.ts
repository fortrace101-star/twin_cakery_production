import { useEffect } from "react";

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

/**
 * Sets the document title and social/description meta tags for the current page.
 * Replaces the per-route `head()` loaders from the old SSR setup.
 */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const fullTitle = `${title} | Twin Cakery`;
    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("name", "twitter:card", "summary_large_image");
  }, [title, description]);
}
