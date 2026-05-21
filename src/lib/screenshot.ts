/**
 * Screenshot capture via Microlink API.
 * No headless browser required — Microlink runs one on their end.
 * Free tier: ~50 req/day without a key; set MICROLINK_API_KEY for higher limits.
 *
 * Docs: https://microlink.io/docs/api/parameters/screenshot
 */

interface MicrolinkData {
  screenshot?: { url: string };
}
interface MicrolinkResponse {
  status:  "success" | "fail" | "error";
  data:    MicrolinkData;
  message?: string;
}

const MICROLINK_BASE = "https://api.microlink.io";

export async function captureScreenshot(targetUrl: string): Promise<string> {
  const params = new URLSearchParams({
    url:        targetUrl,
    screenshot: "true",
    meta:       "false",
    // Request a reasonably large viewport so the AI sees a proper layout
    "viewport.width":  "1280",
    "viewport.height": "900",
    "viewport.deviceScaleFactor": "1",
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.MICROLINK_API_KEY) {
    headers["x-api-key"] = process.env.MICROLINK_API_KEY;
  }

  const response = await fetch(`${MICROLINK_BASE}?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(35_000),
  });

  if (!response.ok) {
    throw new Error(`Screenshot API returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as MicrolinkResponse;

  if (body.status !== "success") {
    throw new Error(body.message ?? `Screenshot capture failed (status: ${body.status})`);
  }

  const screenshotUrl = body.data?.screenshot?.url;
  if (!screenshotUrl) {
    throw new Error("Microlink returned no screenshot URL");
  }

  return screenshotUrl;
}
