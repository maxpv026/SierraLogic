import * as cheerio from "cheerio";
import type { ScrapeResult } from "@/types";

const NOISE_SELECTORS =
  "script, style, noscript, iframe, nav, footer, header, aside, .advertisement, [aria-hidden='true']";

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SierraLogicBot/1.0; +https://sierralogic.ai)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return {
        success: false,
        error: `Unexpected content type: ${contentType}`,
      };
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
      .replace(/[ \t]+/g, " ")       // collapse horizontal whitespace
      .replace(/\n{3,}/g, "\n\n")    // collapse 3+ newlines to double
      .trim()
      .slice(0, 10_000);

    if (!text) {
      return { success: false, error: "No readable text content found on the page" };
    }

    return { success: true, url, title, text };
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
