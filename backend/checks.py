import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
}


# -----------------------------
# Fetch Website
# -----------------------------
def get_soup(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)

        if response.status_code != 200:
            return None

        return BeautifulSoup(response.text, "html.parser")

    except:
        return None


# -----------------------------
# Robots.txt
# -----------------------------
def check_robots(url):

    robots_url = url.rstrip("/") + "/robots.txt"

    try:

        response = requests.get(robots_url, headers=HEADERS, timeout=10)

        if response.status_code == 200:

            return {
                "status": "Found",
                "score": 20,
                "evidence": robots_url,
                "recommendation": "No action required."
            }

        return {
            "status": "Missing",
            "score": 0,
            "evidence": robots_url,
            "recommendation": "Create a robots.txt file."
        }

    except:

        return {
            "status": "Error",
            "score": 0,
            "evidence": robots_url,
            "recommendation": "Unable to verify robots.txt."
        }


# -----------------------------
# Sitemap
# -----------------------------
def check_sitemap(url):

    robots_url = url.rstrip("/") + "/robots.txt"

    try:

        robots = requests.get(robots_url, headers=HEADERS, timeout=10)

        if robots.status_code == 200:

            for line in robots.text.splitlines():

                if line.lower().startswith("sitemap:"):

                    sitemap = line.split(":", 1)[1].strip()

                    return {
                        "status": "Found",
                        "score": 20,
                        "evidence": sitemap,
                        "recommendation": "No action required."
                    }

        sitemap = url.rstrip("/") + "/sitemap.xml"

        response = requests.get(sitemap, headers=HEADERS, timeout=10)

        if response.status_code == 200:

            return {
                "status": "Found",
                "score": 20,
                "evidence": sitemap,
                "recommendation": "No action required."
            }

        return {
            "status": "Missing",
            "score": 0,
            "evidence": sitemap,
            "recommendation": "Create and submit a sitemap."
        }

    except:

        return {
            "status": "Error",
            "score": 0,
            "evidence": "Unable to verify sitemap.",
            "recommendation": "Check sitemap manually."
        }


# -----------------------------
# Meta Tags
# -----------------------------
def check_meta(url):

    soup = get_soup(url)

    if soup is None:

        return {
            "title": "Unable to analyze",
            "description": "Unable to analyze",
            "score": 0,
            "recommendation": "Website blocks automated requests."
        }

    title = soup.title.string.strip() if soup.title else ""

    description = ""

    meta = soup.find("meta", attrs={"name": "description"})

    if meta:
        description = meta.get("content", "")

    score = 0

    if title:
        score += 10

    if description:
        score += 10

    recommendation = "Good meta tags."

    if score < 20:
        recommendation = "Improve title and meta description."

    return {
        "title": title if title else "Missing",
        "description": description if description else "Missing",
        "score": score,
        "recommendation": recommendation
    }


# -----------------------------
# Schema.org
# -----------------------------
def check_schema(url):

    soup = get_soup(url)

    if soup is None:

        return {
            "status": "Unable to analyze",
            "score": 0,
            "evidence": "Website blocked request",
            "recommendation": "Cannot verify Schema."
        }

    schema = soup.find("script", type="application/ld+json")

    if schema:

        return {
            "status": "Found",
            "score": 20,
            "evidence": "JSON-LD detected",
            "recommendation": "No action required."
        }

    return {
        "status": "Missing",
        "score": 0,
        "evidence": "No JSON-LD found",
        "recommendation": "Add Schema.org structured data."
    }


# -----------------------------
# AI Readability
# -----------------------------
def check_content(url):

    soup = get_soup(url)

    if soup is None:

        return {
            "h1": 0,
            "h2": 0,
            "faq": "Unknown",
            "score": 0,
            "recommendation": "Website blocks automated requests."
        }

    h1 = len(soup.find_all("h1"))
    h2 = len(soup.find_all("h2"))

    faq = "Yes" if "faq" in soup.get_text().lower() else "No"

    score = 0

    if h1 > 0:
        score += 5

    if h2 > 0:
        score += 10

    if faq == "Yes":
        score += 5

    recommendation = "Content is AI-friendly."

    if score < 20:
        recommendation = "Improve headings and add FAQ content."

    return {
        "h1": h1,
        "h2": h2,
        "faq": faq,
        "score": score,
        "recommendation": recommendation
    }