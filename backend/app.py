
import ipaddress
import json
import socket
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CATEGORY_WEIGHTS = {
    "Content clarity": 25,
    "Crawlability": 20,
    "Entity and schema signals": 20,
    "Citation readiness": 20,
    "Answer usefulness": 15,
}


def validate_url(url):
    """Allow public HTTP(S) websites, not local/private network addresses."""
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Enter a valid HTTP or HTTPS website URL.")

    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not allowed.")

    host = parsed.hostname

    if host.lower() == "localhost":
        raise ValueError("Localhost URLs cannot be audited.")

    try:
        addresses = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise ValueError("The website domain could not be resolved.")

    if not addresses:
        raise ValueError("No IP address was found for this website.")

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Private or non-public website addresses are not allowed.")

    return url


def fetch_page(url):
    """Fetch a public page and validate every redirect destination."""
    current_url = validate_url(url)
    session = requests.Session()
    session.trust_env = False

    headers = {
        "User-Agent": "GEOAuditor/1.0 (website HTML audit)",
        "Accept": "text/html,application/xhtml+xml",
    }

    for _ in range(6):
        # Validate DNS resolution before every request.
        validate_url(current_url)

        response = session.get(
            current_url,
            headers=headers,
            timeout=15,
            allow_redirects=False,
            stream=True,
        )

        if response.is_redirect or response.is_permanent_redirect:
            location = response.headers.get("Location")
            response.close()

            if not location:
                raise ValueError("The website returned an invalid redirect.")

            current_url = urljoin(current_url, location)
            validate_url(current_url)
            continue

        if response.status_code >= 400:
            status = response.status_code
            response.close()
            raise ValueError(f"The website returned HTTP {status}.")

        content_type = response.headers.get("Content-Type", "").lower()

        if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
            response.close()
            raise ValueError("This URL did not return an HTML page.")

        # Limit download size to 2 MB.
        chunks = []
        total = 0

        try:
            for chunk in response.iter_content(16384):
                total += len(chunk)
                if total > 2 * 1024 * 1024:
                    raise ValueError("The webpage is larger than the 2 MB audit limit.")
                chunks.append(chunk)
        finally:
            response.close()
            session.close()

        return (
            b"".join(chunks),
            current_url,
            response.status_code,
            response.headers.get("Content-Type", ""),
        )

    session.close()
    raise ValueError("Too many redirects.")


def analyze_geo_page(html, url, status_code, content_type):
    soup = BeautifulSoup(html, "html.parser")

    # Exclude non-visible or non-content elements from word counts.
    for element in soup([
        "script", "style", "noscript", "template",
        "svg", "nav", "footer"
    ]):
        element.decompose()

    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    description_tag = soup.find(
        "meta",
        attrs={"name": lambda value: value and value.lower() == "description"}
    )
    description = (
        description_tag.get("content", "").strip()
        if description_tag else ""
    )

    headings = {
        f"h{level}": [
            node.get_text(" ", strip=True)
            for node in soup.find_all(f"h{level}")
            if node.get_text(" ", strip=True)
        ]
        for level in range(1, 7)
    }

    h1_list = headings["h1"]
    h2_list = headings["h2"]

    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = " ".join(main.stripped_strings)
    words = text.split()
    word_count = len(words)

    canonical_tag = soup.find("link", rel="canonical")
    canonical = canonical_tag.get("href", "") if canonical_tag else ""

    robots_tag = soup.find(
        "meta",
        attrs={"name": lambda value: value and value.lower() == "robots"}
    )
    robots_content = robots_tag.get("content", "").lower() if robots_tag else ""

    schema_nodes = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            schema_nodes.append(json.loads(script.string or script.get_text()))
        except (json.JSONDecodeError, TypeError):
            pass

    def contains_type(node):
        if isinstance(node, dict):
            kind = node.get("@type")
            if kind:
                return True
            return any(contains_type(v) for v in node.values())
        if isinstance(node, list):
            return any(contains_type(item) for item in node)
        return False

    valid_schema = any(contains_type(node) for node in schema_nodes)

    org_schema = any(
        isinstance(node, dict)
        and (
            node.get("@type") in ("Organization", "LocalBusiness", "Corporation")
            or (
                isinstance(node.get("@type"), list)
                and any(
                    t in ("Organization", "LocalBusiness", "Corporation")
                    for t in node["@type"]
                )
            )
        )
        for schema in schema_nodes
        for node in (schema if isinstance(schema, list) else [schema])
    )

    external_links = []
    for link in soup.find_all("a", href=True):
        href = urljoin(url, link["href"])
        if urlparse(href).netloc and urlparse(href).netloc != urlparse(url).netloc:
            external_links.append(href)

    images = soup.find_all("img")
    images_with_alt = sum(
        1 for image in images
        if image.has_attr("alt")
    )

    # Each category is scored from its own explicit, weighted checks.
    checks = []

    def add_check(category, name, passed, weight, evidence,
                  recommendation, impact="Medium", effort="Low"):
        checks.append({
            "category": category,
            "name": name,
            "passed": bool(passed),
            "weight": weight,
            "evidence": evidence,
            "recommendation": recommendation,
            "impact": impact,
            "effort": effort,
        })

    add_check(
        "Content clarity", "Descriptive page title",
        bool(title and 10 <= len(title) <= 65), 25,
        f"Title: {title[:200] or 'No title found'}",
        "Write a descriptive title that identifies the page and its purpose.",
        "High", "Low"
    )

    add_check(
        "Content clarity", "Meta description",
        bool(description and 50 <= len(description) <= 200), 20,
        f"Meta description: {description[:300] or 'Not found'}",
        "Write a unique summary describing the page and the value it provides.",
        "Medium", "Low"
    )

    add_check(
        "Content clarity", "Main heading",
        len(h1_list) == 1, 25,
        f"Found {len(h1_list)} H1 heading(s): {h1_list[:3] or 'None'}",
        "Use one clear H1 heading that describes the main topic.",
        "High", "Low"
    )

    add_check(
        "Content clarity", "Section headings",
        len(h2_list) >= 2, 15,
        f"Found {len(h2_list)} H2 heading(s): {h2_list[:5] or 'None'}",
        "Organize the page into descriptive sections using H2 headings.",
        "Medium", "Low"
    )

    add_check(
        "Content clarity", "Substantial page content",
        word_count >= 300, 15,
        f"Counted {word_count} words in the selected page content.",
        "Add useful, specific information that answers likely customer questions.",
        "High", "Medium"
    )

    add_check(
        "Crawlability", "Successful HTML response",
        status_code == 200, 30,
        f"HTTP status: {status_code}; content type: {content_type}",
        "Ensure the canonical page returns a successful HTML response.",
        "High", "Medium"
    )

    add_check(
        "Crawlability", "Canonical URL",
        bool(canonical), 20,
        f"Canonical URL: {canonical or 'Not found'}",
        "Add a correct canonical URL when this page has a preferred address.",
        "Medium", "Low"
    )

    add_check(
        "Crawlability", "No page-level noindex directive",
        "noindex" not in robots_content, 30,
        f"Robots meta content: {robots_content or 'No robots meta directive found'}",
        "Review noindex directives if the page is intended to appear in search.",
        "High", "Low"
    )

    add_check(
        "Crawlability", "Semantic page structure",
        bool(soup.find("main") or soup.find("article")),
        20,
        f"main element: {bool(soup.find('main'))}; article element: {bool(soup.find('article'))}",
        "Use semantic main or article elements to identify the primary page content.",
        "Medium", "Low"
    )

    add_check(
        "Entity and schema signals", "Structured data",
        valid_schema, 60,
        f"JSON-LD blocks: {len(schema_nodes)}; parseable schema with @type: {valid_schema}",
        "Add accurate Schema.org JSON-LD that matches the visible page content.",
        "High", "Medium"
    )

    add_check(
        "Entity and schema signals", "Organization identity schema",
        org_schema, 40,
        f"Organization or local business schema detected: {org_schema}",
        "For a business website, add accurate Organization or LocalBusiness details where appropriate.",
        "Medium", "Medium"
    )

    factual_sentences = [
        sentence for sentence in text.replace("!", ".").replace("?", ".").split(".")
        if len(sentence.split()) >= 8
    ]

    add_check(
        "Citation readiness", "Specific explanatory statements",
        len(factual_sentences) >= 3, 40,
        f"Found {len(factual_sentences)} sentences containing at least 8 words.",
        "Add clear, specific explanations of what you do, how it works, and who it helps.",
        "High", "Medium"
    )

    add_check(
        "Citation readiness", "Relevant external references",
        len(external_links) >= 1, 30,
        f"Found {len(external_links)} external link(s): {external_links[:5] or 'None'}",
        "Link to relevant, trustworthy references when they support factual claims.",
        "Medium", "Low"
    )

    add_check(
        "Citation readiness", "Named business or author information",
        bool(
            soup.find("meta", property="og:site_name")
            or soup.find("meta", attrs={"name": "author"})
            or org_schema
        ),
        30,
        "Detected site name, author metadata, or organization schema: "
        + str(bool(
            soup.find("meta", property="og:site_name")
            or soup.find("meta", attrs={"name": "author"})
            or org_schema
        )),
        "Make the publisher or business identity clear and consistent.",
        "Medium", "Low"
    )

    answer_like = [
        sentence for sentence in factual_sentences
        if 8 <= len(sentence.split()) <= 60
    ]

    add_check(
        "Answer usefulness", "Extractable answer passages",
        len(answer_like) >= 3, 50,
        f"Found {len(answer_like)} candidate explanatory passages.",
        "Add concise, self-contained answers to the questions your customers ask.",
        "High", "Medium"
    )

    add_check(
        "Answer usefulness", "Descriptive image alternatives",
        not images or images_with_alt / len(images) >= 0.8, 25,
        f"{images_with_alt} of {len(images)} images have an alt attribute.",
        "Add accurate alt text to informative images; use empty alt text for decorative images.",
        "Medium", "Low"
    )

    add_check(
        "Answer usefulness", "Useful internal navigation",
        any(
            urlparse(urljoin(url, link.get("href", ""))).netloc
            == urlparse(url).netloc
            for link in soup.find_all("a", href=True)
        ),
        25,
        "Internal links found: " + str(any(
            urlparse(urljoin(url, link.get("href", ""))).netloc
            == urlparse(url).netloc
            for link in soup.find_all("a", href=True)
        )),
        "Provide relevant internal links to services, products, and supporting information.",
        "Medium", "Low"
    )

    category_scores = {}
    for category, category_weight in CATEGORY_WEIGHTS.items():
        category_checks = [c for c in checks if c["category"] == category]
        possible = sum(c["weight"] for c in category_checks)
        earned = sum(c["weight"] for c in category_checks if c["passed"])
        category_score = round(100 * earned / possible) if possible else 0

        category_scores[category] = {
            "score": category_score,
            "weight": category_weight,
            "passed": sum(c["passed"] for c in category_checks),
            "total": len(category_checks),
        }

    overall_score = round(sum(
        details["score"] * details["weight"] / 100
        for details in category_scores.values()
    ))

    findings = []
    for check in checks:
        finding = dict(check)
        finding["priority"] = (
            "High" if not check["passed"] and check["impact"] == "High"
            else "Medium" if not check["passed"]
            else "Pass"
        )
        findings.append(finding)

    priority_order = {"High": 0, "Medium": 1, "Low": 2}
    recommendations = sorted(
        [
            {
                "title": item["name"],
                "category": item["category"],
                "evidence": item["evidence"],
                "fix": item["recommendation"],
                "impact": item["impact"],
                "effort": item["effort"],
                "priority": item["priority"],
            }
            for item in findings if not item["passed"]
        ],
        key=lambda item: (
            priority_order.get(item["priority"], 3),
            0 if item["effort"] == "Low" else 1,
        )
    )

    return {
        "url": url,
        "score": overall_score,
        "title": title,
        "description": description,
        "word_count": word_count,
        "category_scores": category_scores,
        "findings": findings,
        "recommendations": recommendations,
        "limitations": [
            "This report measures HTML signals, not actual citations by AI engines.",
            "JavaScript-rendered content may not be present in the fetched HTML.",
            "A missing signal does not by itself prove that an AI engine cannot access the page.",
            "A meta robots directive is not a complete evaluation of robots.txt or crawler access.",
        ],
    }


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "GEO Auditor API"})


@app.route("/api/audit", methods=["POST"])
def audit():
    data = request.get_json(silent=True) or {}
    url = str(data.get("url", "")).strip()

    if not url:
        return jsonify({"error": "Please provide a website URL."}), 400

    try:
        html, final_url, status_code, content_type = fetch_page(url)
        report = analyze_geo_page(html, final_url, status_code, content_type)
        return jsonify(report)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except requests.RequestException as error:
        app.logger.warning("Website fetch failed: %s", error)
        return jsonify({
            "error": "Could not fetch the website. Check whether it is accessible."
        }), 502
    except Exception:
        app.logger.exception("Audit failed")
        return jsonify({"error": "The audit failed unexpectedly."}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
