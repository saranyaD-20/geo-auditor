🌐 GEO Auditor

GEO Auditor is a web application that evaluates a website's readiness for AI-powered search and answer engines, including ChatGPT, Google AI Overviews, Claude, and Perplexity.

The application analyzes technical accessibility and content signals that may help AI systems discover, interpret, and reference website content. It provides a score, identifies potential issues, and suggests actionable improvements.

🎯 Problem Statement

Traditional SEO tools primarily focus on conventional search engine optimization. GEO Auditor focuses on signals relevant to how AI-powered search systems may access and understand website content.

The goal is to help website owners identify potential improvements in their website structure, metadata, content readability, and technical accessibility.

✨ Key Features

- Website URL analysis
- `robots.txt` availability and rule checks
- Sitemap discovery
- Meta title and description analysis
- Schema.org structured data detection
- AI-oriented content readability checks
- GEO score and category-level findings
- Actionable recommendations
- Prioritized fixes to help guide improvements

 🏗️ How It Works

1. The user enters a website URL in the frontend.
2. The application sends the URL to the analysis API.
3. The backend retrieves accessible website content and relevant technical resources.
4. Analysis rules evaluate metadata, structured data, accessibility signals, and content characteristics.
5. The scoring logic combines the implemented checks into a GEO readiness score.
6. The application displays findings, recommendations, and priority fixes.

Note:A higher score indicates stronger performance against the application's configured checks. It does not guarantee that a website will be cited by an AI search engine.

🧮 GEO Score Calculation

The GEO score is calculated using predefined checks implemented in the analyzer.

Document the following details from your actual code:

- Evaluation criteria: The website signals being checked.
- Scoring rules:How each check contributes to the score.
- Weighting: Whether some checks contribute more than others.
- Normalization: How the final score is converted to a 0–100 scale.
- Recommendations:How failed or incomplete checks map to suggested fixes.

Add the actual formula and weights after verifying the implementation in the analyzer code.

🛠️ Technology Stack

Frontend
- HTML
- CSS
- JavaScript / React, depending on the deployed frontend implementation

Backend and analysis
- Python
- Flask for the legacy backend
- BeautifulSoup
- Requests

Deployment
- Netlify
- Netlify serverless function at `netlify/functions/analyze.mts`
- API endpoint: `/api/analyze`
  
Website : https://geo-auditor.netlify.app/

🚀 Local Setup

Option A: Run the Netlify application

Prerequisites: Node.js and npm.

1. Clone the repository:

   ```bash
   git clone https://github.com/saranyaD-20/geo-auditor.git
   cd geo-auditor
   ```

2. Install dependencies for the frontend:

   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. Start the application from the repository root:

   ```bash
   npx netlify-cli dev
   ```

   Open the local URL displayed in the terminal.

   Make sure the Netlify CLI and required configuration are present in the repository.

### Option B: Run the legacy Flask backend

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create and activate a virtual environment.

   Windows PowerShell:

   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

   macOS/Linux:

   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   python -m pip install -r requirements.txt
   ```

4. Start the Flask server:

   ```bash
   python app.py
   ```

   Use the local address printed by Flask to access the backend.

   The frontend and Flask backend must be configured to communicate with each other if you want to run them together.

 🔌 API Documentation

### Analyze a website

Endpoint:`POST /api/analyze`

**Request example:**

```json
{
  "url": "https://example.com"
}
```

Document the response format using an actual response from your running application. Include the score, individual checks, recommendations, and error handling only if those fields are implemented.

 ⚠️ Limitations

- Results depend on the website content accessible to the analyzer.
- JavaScript-rendered content may not be fully captured by a basic HTTP request and HTML parser.
- Website changes do not guarantee inclusion or citation in AI-generated answers.
- Analysis results represent the application's checks, not an official ranking from AI search providers.
- Network restrictions, bot protection, and unavailable resources can affect analysis.

🔮 Future Improvements

- Playwright support for JavaScript-rendered pages
- PDF report export
- Multiple-page website analysis
- Open Graph and canonical URL checks
- Historical score tracking
- More detailed accessibility and structured-data checks
👩‍💻 Author

Saranya D

B.Tech – Artificial Intelligence and Data Science

GitHub: https://github.com/saranyaD-20

---

*GEO Auditor is an independent analysis tool. It is not affiliated with or endorsed by OpenAI, Google, Anthropic, or Perplexity.*
