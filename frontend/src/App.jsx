import { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {

  const [url, setUrl] = useState("");

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const analyzeWebsite = async () => {

    if (url === "") {
      alert("Enter Website URL");
      return;
    }

    setLoading(true);

    try {

      const response = await axios.post(
        "http://127.0.0.1:5000/analyze",
        {
          url: url
        }
      );

      setResult(response.data);

    }

    catch (err) {

      console.log(err);

      alert("Backend is not running!");

    }

    setLoading(false);

  };


  const getColor = (score) => {

    if (score >= 80)
      return "green";

    if (score >= 50)
      return "orange";

    return "red";

  };


  const getRating = (score) => {

    if (score >= 80)
      return "Excellent";

    if (score >= 50)
      return "Needs Improvement";

    return "Poor";

  };



  return (

    <div
      style={{
        background: "#0f172a",
        minHeight: "100vh",
        color: "white",
        padding: "40px",
        fontFamily: "Arial"
      }}
    >

      <h1
        style={{
          textAlign: "center",
          fontSize: "60px"
        }}
      >

        🌐 GEO Auditor

      </h1>

      <div
        style={{
          textAlign: "center",
          marginTop: "30px"
        }}
      >

        <input

          type="text"

          placeholder="https://example.com"

          value={url}

          onChange={(e) => setUrl(e.target.value)}

          style={{

            width: "700px",

            padding: "15px",

            fontSize: "18px"

          }}

        />

        <br /><br />

        <button

          onClick={analyzeWebsite}

          style={{

            padding: "12px 35px",

            fontSize: "20px",

            cursor: "pointer"

          }}

        >

          {loading ? "Analyzing..." : "Analyze"}

        </button>

      </div>


      {

        result &&

        (

          <div

            style={{

              width: "900px",

              margin: "40px auto",

              background: "#1e293b",

              padding: "30px",

              borderRadius: "10px"

            }}

          >

            <h1
              style={{
                textAlign: "center"
              }}
            >

              GEO Audit Report

            </h1>

            <hr />

            <h2>Website</h2>

            <p>{result.website}</p>

            <h2>Overall GEO Score</h2>

            <h1
              style={{
                color: getColor(result.total_score)
              }}
            >

              {result.total_score}/100

            </h1>

            <h3>

              Overall Rating :
              {" "}
              {getRating(result.total_score)}

            </h3>

            <hr />



            <h2>🤖 Robots.txt</h2>

            <p><b>Status :</b> {result.robots.status}</p>

            <p><b>Score :</b> {result.robots.score}</p>

            <p><b>Evidence :</b> {result.robots.evidence}</p>

            <p><b>Recommendation :</b> {result.robots.recommendation}</p>

            <hr />



            <h2>🗺 Sitemap.xml</h2>

            <p><b>Status :</b> {result.sitemap.status}</p>

            <p><b>Score :</b> {result.sitemap.score}</p>

            <p><b>Evidence :</b> {result.sitemap.evidence}</p>

            <p><b>Recommendation :</b> {result.sitemap.recommendation}</p>

            <hr />



            <h2>🏷 Meta Tags</h2>

            <p><b>Title :</b> {result.meta.title}</p>

            <p><b>Description :</b> {result.meta.description}</p>

            <p><b>Score :</b> {result.meta.score}</p>

            <p><b>Recommendation :</b> {result.meta.recommendation}</p>

            <hr />



            <h2>📊 Schema.org</h2>

            <p><b>Status :</b> {result.schema.status}</p>

            <p><b>Score :</b> {result.schema.score}</p>

            <p><b>Evidence :</b> {result.schema.evidence}</p>

            <p><b>Recommendation :</b> {result.schema.recommendation}</p>

            <hr />



            <h2>📝 AI Readability</h2>

            <p><b>H1 :</b> {result.content.h1}</p>

            <p><b>H2 :</b> {result.content.h2}</p>

            <p><b>FAQ :</b> {result.content.faq}</p>

            <p><b>Score :</b> {result.content.score}</p>

            <p><b>Recommendation :</b> {result.content.recommendation}</p>

            <hr />



            <h2>🚀 Priority Fixes</h2>

            <ul>

              {

                result.robots.score !== 20 &&

                <li>Create a robots.txt file.</li>

              }

              {

                result.sitemap.score !== 20 &&

                <li>Add a sitemap.xml and submit it to search engines.</li>

              }

              {

                result.meta.score !== 20 &&

                <li>Improve page title and meta description.</li>

              }

              {

                result.schema.score !== 20 &&

                <li>Add Schema.org JSON-LD markup.</li>

              }

              {

                result.content.score !== 20 &&

                <li>Improve headings and add FAQ content.</li>

              }

            </ul>

          </div>

        )

      }

    </div>

  );

}

export default App;