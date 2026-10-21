import type { Config } from "@netlify/functions";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const fetchWithTimeout = (url: string) =>
  fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(8000) });

// Fetch the page once and share the parsed document across checks
async function getSoup(url: string) {
  try {
    const response = await fetchWithTimeout(url);
    if (response.status !== 200) return null;
    return cheerio.load(await response.text());
  } catch {
    return null;
  }
}

async function checkRobots(base: string) {
  const robotsUrl = base + "/robots.txt";
  try {
    const response = await fetchWithTimeout(robotsUrl);
    if (response.status === 200) {
      return { status: "Found", score: 20, evidence: robotsUrl, recommendation: "No action required." };
    }
    return { status: "Missing", score: 0, evidence: robotsUrl, recommendation: "Create a robots.txt file." };
  } catch {
    return { status: "Error", score: 0, evidence: robotsUrl, recommendation: "Unable to verify robots.txt." };
  }
}

async function checkSitemap(base: string) {
  try {
    const robots = await fetchWithTimeout(base + "/robots.txt");
    if (robots.status === 200) {
      for (const line of (await robots.text()).split(/\r?\n/)) {
        if (line.trim().toLowerCase().startsWith("sitemap:")) {
          const sitemap = line.trim().slice("sitemap:".length).trim();
          return { status: "Found", score: 20, evidence: sitemap, recommendation: "No action required." };
        }
      }
    }

    const sitemap = base + "/sitemap.xml";
    const response = await fetchWithTimeout(sitemap);
    if (response.status === 200) {
      return { status: "Found", score: 20, evidence: sitemap, recommendation: "No action required." };
    }
    return { status: "Missing", score: 0, evidence: sitemap, recommendation: "Create and submit a sitemap." };
  } catch {
    return {
      status: "Error",
      score: 0,
      evidence: "Unable to verify sitemap.",
      recommendation: "Check sitemap manually.",
    };
  }
}

function checkMeta($: cheerio.CheerioAPI | null) {
  if (!$) {
    return {
      title: "Unable to analyze",
      description: "Unable to analyze",
      score: 0,
      recommendation: "Website blocks automated requests.",
    };
  }

  const title = $("title").first().text().trim();
  const description = ($('meta[name="description" i]').attr("content") || "").trim();

  let score = 0;
  if (title) score += 10;
  if (description) score += 10;

  return {
    title: title || "Missing",
    description: description || "Missing",
    score,
    recommendation: score < 20 ? "Improve title and meta description." : "Good meta tags.",
  };
}

function checkSchema($: cheerio.CheerioAPI | null) {
  if (!$) {
    return {
      status: "Unable to analyze",
      score: 0,
      evidence: "Website blocked request",
      recommendation: "Cannot verify Schema.",
    };
  }

  if ($('script[type="application/ld+json"]').length > 0) {
    return { status: "Found", score: 20, evidence: "JSON-LD detected", recommendation: "No action required." };
  }
  return {
    status: "Missing",
    score: 0,
    evidence: "No JSON-LD found",
    recommendation: "Add Schema.org structured data.",
  };
}

function checkContent($: cheerio.CheerioAPI | null) {
  if (!$) {
    return { h1: 0, h2: 0, faq: "Unknown", score: 0, recommendation: "Website blocks automated requests." };
  }

  const h1 = $("h1").length;
  const h2 = $("h2").length;
  const faq = $("body").text().toLowerCase().includes("faq") ? "Yes" : "No";

  let score = 0;
  if (h1 > 0) score += 5;
  if (h2 > 0) score += 10;
  if (faq === "Yes") score += 5;

  return {
    h1,
    h2,
    faq,
    score,
    recommendation: score < 20 ? "Improve headings and add FAQ content." : "Content is AI-friendly.",
  };
}

export default async (req: Request) => {
  let data: { url?: string };
  try {
    data = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let url = (data.url || "").trim();
  if (!url) {
    return Response.json({ error: "Website URL is required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "Invalid website URL" }, { status: 400 });
  }

  const base = url.replace(/\/+$/, "");
  const [robots, sitemap, $] = await Promise.all([checkRobots(base), checkSitemap(base), getSoup(parsed.href)]);
  const meta = checkMeta($);
  const schema = checkSchema($);
  const content = checkContent($);

  const total_score = robots.score + sitemap.score + meta.score + schema.score + content.score;

  return Response.json({ website: url, total_score, robots, sitemap, meta, schema, content });
};

export const config: Config = {
  path: "/api/analyze",
  method: "POST",
};
