from flask import Flask, request, jsonify
from flask_cors import CORS

from checks import (
    check_robots,
    check_sitemap,
    check_meta,
    check_schema,
    check_content
)

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({
        "message": "GEO Auditor Backend Running"
    })


@app.route("/analyze", methods=["POST"])
def analyze():

    data = request.get_json()

    url = data.get("url")

    if not url:
        return jsonify({"error": "Website URL is required"}), 400

    robots = check_robots(url)
    sitemap = check_sitemap(url)
    meta = check_meta(url)
    schema = check_schema(url)
    content = check_content(url)

    total_score = (
        robots["score"] +
        sitemap["score"] +
        meta["score"] +
        schema["score"] +
        content["score"]
    )

    return jsonify({

        "website": url,

        "total_score": total_score,

        "robots": robots,

        "sitemap": sitemap,

        "meta": meta,

        "schema": schema,

        "content": content

    })


if __name__ == "__main__":
    app.run(debug=True)