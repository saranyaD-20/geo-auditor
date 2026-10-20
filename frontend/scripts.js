
const form = document.getElementById("auditForm");
const input = document.getElementById("websiteUrl");
const message = document.getElementById("message");
const results = document.getElementById("results");
const analyzeButton = document.getElementById("analyzeButton");

let latestReport = null;

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function setMessage(text) {
  message.textContent = text;
}

/* Clipboard helper with fallback */
async function copyFixToClipboard(text, button) {
  const fix = String(text || "").trim();

  if (!fix) {
    setMessage("No recommendation is available to copy.");
    return;
  }

  const originalText = button.textContent;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(fix);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = fix;
      textarea.readOnly = true;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const success = document.execCommand("copy");
      textarea.remove();

      if (!success) {
        throw new Error("Browser clipboard access was denied.");
      }
    }

    button.textContent = "Copied!";
    button.classList.add("copied");
    setMessage("Recommendation copied to clipboard.");

    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("copied");
    }, 2000);
  } catch (error) {
    console.error("Clipboard error:", error);

    // Keep the recommendation accessible if clipboard access fails.
    setMessage(
      "Automatic copying failed. The recommendation is displayed on the card; select its text and copy it manually."
    );
  }
}

/* Update the score ring */
function updateScoreRing(score) {
  const scoreRing = document.getElementById("scoreRing");
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

  scoreRing.style.setProperty("--progress", `${safeScore * 3.6}deg`);
  scoreRing.setAttribute(
    "aria-label",
    `GEO readiness ${safeScore} percent`
  );
}

/* Display category scores */
function renderCategories(categoryScores) {
  const container = document.getElementById("categoryScores");
  container.replaceChildren();

  for (const [name, details] of Object.entries(categoryScores || {})) {
    const card = makeElement("article", "category-card");
    const heading = makeElement("h4", "", name);

    const hasScore =
      typeof details.score === "number" &&
      Number.isFinite(details.score);

    const value = makeElement(
      "div",
      "category-value",
      hasScore ? `${details.score}/100` : "N/A"
    );

    const weight = makeElement(
      "p",
      "muted",
      `${details.weight ?? 0}% of overall score`
    );

    const track = makeElement("div", "progress-track");
    const fill = makeElement("div", "progress-fill");

    fill.style.width = `${hasScore
      ? Math.max(0, Math.min(100, details.score))
      : 0}%`;

    track.appendChild(fill);
    card.append(heading, value, weight, track);

    if (details.summary) {
      card.appendChild(makeElement("p", "muted", details.summary));
    }

    container.appendChild(card);
  }
}

/* Display expandable audit checks */
function renderChecks(findings) {
  const container = document.getElementById("auditChecks");
  container.replaceChildren();

  for (const finding of findings || []) {
    const item = makeElement("div", "audit-item");
    const toggle = makeElement("button", "audit-toggle");

    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");

    const status = finding.status || (
      finding.passed === true ? "pass" : "warning"
    );

    const statusLabels = {
      pass: "✓ PASS",
      warning: "⚠ REVIEW",
      fail: "✗ NEEDS WORK",
      not_applicable: "— NOT APPLICABLE"
    };

    const statusClass = {
      pass: "pass",
      warning: "warning",
      fail: "fail",
      not_applicable: "muted"
    };

    const label = makeElement(
      "span",
      statusClass[status] || "muted",
      `${statusLabels[status] || "⚠ REVIEW"} — ${finding.name || "Audit check"}`
    );

    const arrow = makeElement("span", "", "+");
    toggle.append(label, arrow);

    const detail = makeElement("div", "audit-detail");
    detail.hidden = true;

    detail.appendChild(
      makeElement("p", "", `Category: ${finding.category || "General"}`)
    );

    detail.appendChild(
      makeElement(
        "p",
        "",
        `Evidence: ${finding.evidence || "No evidence provided."}`
      )
    );

    if (finding.why_it_matters || finding.impact) {
      detail.appendChild(
        makeElement(
          "p",
          "",
          `Why it matters: ${finding.why_it_matters || finding.impact}`
        )
      );
    }

    if (finding.recommended_fix || finding.recommendation) {
      detail.appendChild(
        makeElement(
          "p",
          "",
          `Recommended fix: ${finding.recommended_fix || finding.recommendation}`
        )
      );
    }

    if (finding.how_to_validate) {
      detail.appendChild(
        makeElement(
          "p",
          "",
          `How to validate: ${finding.how_to_validate}`
        )
      );
    }

    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";

      toggle.setAttribute("aria-expanded", String(!isOpen));
      detail.hidden = isOpen;
      arrow.textContent = isOpen ? "+" : "−";
    });

    item.append(toggle, detail);
    container.appendChild(item);
  }
}

/* Display recommendations and working Copy fix buttons */
function renderRecommendations(recommendations) {
  const container = document.getElementById("recommendations");
  container.replaceChildren();

  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    container.appendChild(
      makeElement("p", "muted", "No outstanding recommendations were returned.")
    );
    return;
  }

  recommendations.forEach((recommendation, index) => {
    const card = makeElement("article", "recommendation-card");
    const top = makeElement("div", "recommendation-top");

    const titleText =
      recommendation.issue ||
      recommendation.title ||
      recommendation.name ||
      "Recommended improvement";

    const title = makeElement("h4", "", `${index + 1}. ${titleText}`);
    const priority = makeElement(
      "span",
      "priority",
      recommendation.priority || "Review"
    );

    top.append(title, priority);

    const evidence = makeElement(
      "p",
      "muted",
      `Evidence: ${recommendation.evidence || "Review the related audit check."}`
    );

    const reason = recommendation.reason || recommendation.why_it_matters;

    if (reason) {
      card.appendChild(makeElement("p", "", `Impact: ${reason}`));
    }

    const fixText = String(
      recommendation.fix ||
      recommendation.recommended_fix ||
      recommendation.recommendation ||
      ""
    );

    const fixLabel = makeElement("p", "field-label", "Recommended fix");
    const fix = makeElement("p", "recommendation-fix", fixText);

    const validation = recommendation.validation || recommendation.how_to_validate;

    const metadata = makeElement(
      "p",
      "field-label",
      `Category: ${recommendation.category || "General"}`
    );

    const copyButton = makeElement("button", "secondary-btn", "Copy fix");
    copyButton.type = "button";

    copyButton.addEventListener("click", () => {
      copyFixToClipboard(fixText, copyButton);
    });

    const doneLabel = makeElement("label", "done-label");
    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";

    doneLabel.append(
      checkbox,
      document.createTextNode(" Mark as completed")
    );

    if (validation) {
      card.appendChild(
        makeElement("p", "", `How to validate: ${validation}`)
      );
    }

    card.append(
      top,
      evidence,
      fixLabel,
      fix,
      metadata,
      copyButton,
      doneLabel
    );

    container.appendChild(card);
  });
}

/* Display report limitations */
function renderLimitations(limitations) {
  const container = document.getElementById("limitations");
  container.replaceChildren();

  for (const limitation of limitations || []) {
    container.appendChild(makeElement("p", "muted", `• ${limitation}`));
  }
}

/* Render the complete audit report */
function renderReport(data) {
  if (
    typeof data.score !== "number" ||
    !data.category_scores ||
    !Array.isArray(data.findings)
  ) {
    throw new Error("The API response is missing audit results.");
  }

  latestReport = data;
  results.hidden = false;

  const auditedUrl = document.getElementById("auditedUrl");
  auditedUrl.textContent = data.url || "";
  auditedUrl.href = data.url || "#";

  document.getElementById("score").textContent = data.score;
  document.getElementById("scorePercent").textContent = `${data.score}%`;

  updateScoreRing(data.score);

  document.getElementById("scoreLabel").textContent =
    data.score >= 80 ? "Strong observable signals" :
    data.score >= 60 ? "Good progress — room to improve" :
    data.score >= 40 ? "Several areas need attention" :
    "Significant improvements recommended";

  document.getElementById("pageTitle").textContent =
    data.title || "No title detected";

  document.getElementById("pageDescription").textContent =
    data.description || "No meta description detected";

  document.getElementById("wordCount").textContent =
    data.word_count ?? "Unavailable";

  renderCategories(data.category_scores);
  renderChecks(data.findings);
  renderRecommendations(data.recommendations);
  renderLimitations(data.limitations);

  // Display the score's explanation when the matching HTML element exists.
  let disclaimer = document.getElementById("scoreDisclaimer");

  if (data.score_disclaimer) {
    if (!disclaimer) {
      disclaimer = makeElement("p");
      disclaimer.id = "scoreDisclaimer";

      document.getElementById("scoreLabel").insertAdjacentElement(
        "afterend",
        disclaimer
      );
    }

    disclaimer.textContent = data.score_disclaimer;
  }

  setMessage("Audit completed successfully.");
}

/* Submit website for auditing */
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = input.value.trim();

  if (!url) {
    setMessage("Enter a website URL.");
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Analyzing website...";
  results.hidden = true;

  setMessage("Fetching the webpage and checking its signals...");

  try {
    const response = await fetch("/api/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        "The server returned HTML instead of JSON. Check Flask and the Vite proxy."
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Audit failed: HTTP ${response.status}`);
    }

    renderReport(data);
  } catch (error) {
    console.error("GEO Auditor:", error);
    setMessage(error.message || "Could not complete the audit.");
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.innerHTML = 'Analyze Website <span>→</span>';
  }
});

/* Export the latest report as JSON */
document.getElementById("exportBtn").addEventListener("click", () => {
  if (!latestReport) {
    setMessage("Run an audit before exporting.");
    return;
  }

  const blob = new Blob(
    [JSON.stringify(latestReport, null, 2)],
    { type: "application/json" }
  );

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "geo-audit-report.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(downloadUrl);
});
