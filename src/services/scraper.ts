import * as cheerio from "cheerio";
import type { ScrapeResult } from "@/types";

const NOISE_SELECTORS =
  "script, style, noscript, iframe, nav, footer, header, aside, .advertisement, [aria-hidden='true']";

const JINA_BASE = "https://r.jina.ai/";

async function scrapeViaJina(url: string): Promise<ScrapeResult> {
  const jinaUrl = `${JINA_BASE}${url}`;

  const headers: Record<string, string> = {
    Accept: "text/plain",
    "X-Return-Format": "markdown",
    "X-Remove-Selector": "header, nav, footer",
    "X-Timeout": "15",
  };

  if (process.env.JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
  }

  const response = await fetch(jinaUrl, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Jina returned HTTP ${response.status}`);
  }

  const text = (await response.text())
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 10_000);

  if (!text) {
    throw new Error("Jina returned empty content");
  }

  const titleMatch = text.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? new URL(url).hostname;

  return { success: true, url, title, text };
}

async function scrapeViaFetch(url: string): Promise<ScrapeResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SierraLogicBot/1.0; +https://sierralogic.ai)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return { success: false, error: `Unexpected content type: ${contentType}` };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $(NOISE_SELECTORS).remove();

  const title =
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    new URL(url).hostname;

  const root = $("main").length ? $("main") : $("body");

  const text = root
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 10_000);

  if (!text) {
    return { success: false, error: "No readable text content found on the page" };
  }

  return { success: true, url, title, text };
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  // Try Jina Reader first — handles JS-heavy SPAs via headless browser
  try {
    return await scrapeViaJina(url);
  } catch {
    // Jina failed; fall back to direct HTML fetch + Cheerio
  }

  try {
    return await scrapeViaFetch(url);
  } catch (err) {
    if (err instanceof Error) {
      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
      return {
        success: false,
        error: isTimeout ? "Request timed out after 10 seconds" : err.message,
      };
    }
    return { success: false, error: "An unexpected error occurred while scraping" };
  }
}
