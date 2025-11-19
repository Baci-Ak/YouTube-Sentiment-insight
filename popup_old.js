// popup.js

// ====== CONFIG LAYERS (read this first) ======
//
// 1) Remote production config (S3)
//    - Public JSON file: https://yt-sentiment-config-baci.s3.amazonaws.com/config.json
//    - Example content:
//        { "API_URL": "http://54.242.62.191:8080" }
//
//    This lets you change the backend URL from AWS console without
//    changing this code or reloading the extension.
//
// 2) Local config.js (NOT committed to Git)
//    - File: yt-chrome-plugin-frontend/config.js (gitignored)
//    - Example:
//        window.APP_CONFIG = {
//          YT_API_KEY: "YOUR_YOUTUBE_API_KEY",
//          // Optional (for LOCAL dev only):
//          // API_URL: "http://localhost:5001"
//        };
//
//    This is where your **private** YouTube API key lives.
//    Do NOT put the key in S3 or GitHub.
//
// 3) Local-only fallback (no AWS)
//    - If you want to run everything locally:
//        • Start  Flask API on http://localhost:5001
//        • In config.js, set API_URL: "http://localhost:5001"
//        • The code below will use that if present.
//

const S3_CONFIG_URL = "https://yt-sentiment-config-baci.s3.amazonaws.com/config.json";
const DEFAULT_LOCAL_API_URL = "http://localhost:5001"; // used for pure local/dev mode
const MAX_COMMENTS = 1000; // increase/decrease if needed

document.addEventListener("DOMContentLoaded", async () => {
  const outputDiv = document.getElementById("output");

  // ---- 1) Load API_URL from S3 config.json (non-secret) ----
  let apiUrl = DEFAULT_LOCAL_API_URL;
  let remoteConfigUsed = false;

  try {
    const resp = await fetch(S3_CONFIG_URL, { cache: "no-store" });
    if (resp.ok) {
      const cfg = await resp.json();
      if (cfg && cfg.API_URL) {
        apiUrl = cfg.API_URL;
        remoteConfigUsed = true;
      } else {
        console.warn("S3 config.json missing API_URL; falling back to local config.js / localhost.");
      }
    } else {
      console.warn("Failed to fetch S3 config.json:", resp.status, resp.statusText);
    }
  } catch (err) {
    console.warn("Could not reach S3 config.json, falling back:", err);
  }

  // ---- 2) Overlay local config.js (for API key + optional override) ----
  //
  // config.js is NOT in GitHub. It is only on your local machine / packaged in the extension.
  // It should contain at least:
  //   window.APP_CONFIG = { YT_API_KEY: "..." }
  //
  // Optionally, for **local-only** backend development, you can also set:
  //   API_URL: "http://localhost:5001"
  //
  // If APP_CONFIG.API_URL is present, we treat it as "developer override".
  let apiKey = "";
  if (window.APP_CONFIG) {
    if (window.APP_CONFIG.API_URL) {
      apiUrl = window.APP_CONFIG.API_URL; // local override for dev
    }
    if (window.APP_CONFIG.YT_API_KEY) {
      apiKey = window.APP_CONFIG.YT_API_KEY;
    }
  }

  // Optional tiny debug message in the UI
  if (!remoteConfigUsed) {
    outputDiv.innerHTML =
      "<p style='color:#888; font-size:12px;'>Could not read API_URL from S3 config.json, using local config.js / localhost fallback.</p>";
  }

  // Safety check: YouTube API key must exist
  if (!apiKey) {
    outputDiv.innerHTML +=
      "<p style='color:#ff6666;'>Missing YouTube API key. Set YT_API_KEY in config.js (local, not in Git).</p>";
    return;
  }

 

  // Get the current tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const url = tabs[0]?.url || "";
    const youtubeRegex = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
      const videoId = match[1];
      outputDiv.innerHTML += `<div class="section-title">YouTube Video ID</div><p>${videoId}</p><p>Fetching comments...</p>`;

      const comments = await fetchComments(videoId, apiKey, outputDiv);
      if (comments.length === 0) {
        outputDiv.innerHTML += "<p>No comments found for this video.</p>";
        return;
      }

      outputDiv.innerHTML += `<p>Fetched ${comments.length} comments. Performing sentiment analysis...</p>`;
      const predictions = await getSentimentPredictions(comments, apiUrl, outputDiv);

      if (predictions) {
        // Process the predictions to get sentiment counts and sentiment data
        const sentimentCounts = { "1": 0, "0": 0, "-1": 0 };
        const sentimentData = []; // For trend graph
        const totalSentimentScore = predictions.reduce(
          (sum, item) => sum + parseInt(item.sentiment),
          0
        );

        predictions.forEach((item) => {
          sentimentCounts[item.sentiment]++;
          sentimentData.push({
            timestamp: item.timestamp,
            sentiment: parseInt(item.sentiment),
          });
        });

        // Compute metrics
        const totalComments = comments.length;
        const uniqueCommenters = new Set(comments.map((comment) => comment.authorId)).size;
        const totalWords = comments.reduce(
          (sum, comment) =>
            sum +
            comment.text
              .split(/\s+/)
              .filter((word) => word.length > 0).length,
          0
        );
        const avgWordLength = (totalWords / totalComments).toFixed(2);
        const avgSentimentScore = (totalSentimentScore / totalComments).toFixed(2);

        // Normalize the average sentiment score to a scale of 0 to 10
        const normalizedSentimentScore = (
          ((parseFloat(avgSentimentScore) + 1) / 2) *
          10
        ).toFixed(2);

        // Comment Analysis Summary
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Comment Analysis Summary</div>
            <div class="metrics-container">
              <div class="metric">
                <div class="metric-title">Total Comments</div>
                <div class="metric-value">${totalComments}</div>
              </div>
              <div class="metric">
                <div class="metric-title">Unique Commenters</div>
                <div class="metric-value">${uniqueCommenters}</div>
              </div>
              <div class="metric">
                <div class="metric-title">Avg Comment Length</div>
                <div class="metric-value">${avgWordLength} words</div>
              </div>
              <div class="metric">
                <div class="metric-title">Avg Sentiment Score</div>
                <div class="metric-value">${normalizedSentimentScore}/10</div>
              </div>
            </div>
          </div>
        `;

        // Sentiment Analysis Results + chart placeholder
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Sentiment Analysis Results</div>
            <p>See the pie chart below for sentiment distribution.</p>
            <div id="chart-container"></div>
          </div>`;

        // Fetch and display the pie chart
        await fetchAndDisplayChart(sentimentCounts, apiUrl, outputDiv);

        // Sentiment Trend Graph
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Sentiment Trend Over Time</div>
            <div id="trend-graph-container"></div>
          </div>`;

        await fetchAndDisplayTrendGraph(sentimentData, apiUrl, outputDiv);

        // Word Cloud
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Comment Wordcloud</div>
            <div id="wordcloud-container"></div>
          </div>`;

        await fetchAndDisplayWordCloud(
          comments.map((comment) => comment.text),
          apiUrl,
          outputDiv
        );

        // Top comments
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Top 25 Comments with Sentiments</div>
            <ul class="comment-list">
              ${predictions
                .slice(0, 25)
                .map(
                  (item, index) => `
                <li class="comment-item">
                  <span>${index + 1}. ${item.comment}</span><br>
                  <span class="comment-sentiment">Sentiment: ${item.sentiment}</span>
                </li>`
                )
                .join("")}
            </ul>
          </div>`;
      }
    } else {
      outputDiv.innerHTML += "<p>This is not a valid YouTube URL.</p>";
    }
  });
});

// ---- helper functions ----

async function fetchComments(videoId, apiKey, outputDiv) {
  let comments = [];
  let pageToken = "";
  try {
    while (comments.length < MAX_COMMENTS) {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&pageToken=${pageToken}&key=${apiKey}`
      );
      const data = await response.json();
      if (data.items) {
        data.items.forEach((item) => {
          const snippet = item.snippet.topLevelComment.snippet;
          const commentText = snippet.textOriginal;
          const timestamp = snippet.publishedAt;
          const authorId = snippet.authorChannelId?.value || "Unknown";
          comments.push({ text: commentText, timestamp: timestamp, authorId: authorId });
        });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  } catch (error) {
    console.error("Error fetching comments:", error);
    outputDiv.innerHTML += "<p>Error fetching comments.</p>";
  }
  return comments;
}

async function getSentimentPredictions(comments, apiUrl, outputDiv) {
  try {
    const response = await fetch(`${apiUrl}/predict_with_timestamps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments }),
    });
    const result = await response.json();
    if (response.ok) {
      return result; // includes sentiment + timestamp
    } else {
      throw new Error(result.error || "Error fetching predictions");
    }
  } catch (error) {
    console.error("Error fetching predictions:", error);
    outputDiv.innerHTML += "<p>Error fetching sentiment predictions.</p>";
    return null;
  }
}

async function fetchAndDisplayChart(sentimentCounts, apiUrl, outputDiv) {
  try {
    const response = await fetch(`${apiUrl}/generate_chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_counts: sentimentCounts }),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch chart image");
    }
    const blob = await response.blob();
    const imgURL = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgURL;
    img.style.width = "100%";
    img.style.marginTop = "20px";

    const chartContainer = document.getElementById("chart-container");
    chartContainer.appendChild(img);
  } catch (error) {
    console.error("Error fetching chart image:", error);
    outputDiv.innerHTML += "<p>Error fetching chart image.</p>";
  }
}

async function fetchAndDisplayWordCloud(comments, apiUrl, outputDiv) {
  try {
    const response = await fetch(`${apiUrl}/generate_wordcloud`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments }),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch word cloud image");
    }
    const blob = await response.blob();
    const imgURL = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgURL;
    img.style.width = "100%";
    img.style.marginTop = "20px";

    const wordcloudContainer = document.getElementById("wordcloud-container");
    wordcloudContainer.appendChild(img);
  } catch (error) {
    console.error("Error fetching word cloud image:", error);
    outputDiv.innerHTML += "<p>Error fetching word cloud image.</p>";
  }
}

async function fetchAndDisplayTrendGraph(sentimentData, apiUrl, outputDiv) {
  try {
    const response = await fetch(`${apiUrl}/generate_trend_graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_data: sentimentData }),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch trend graph image");
    }
    const blob = await response.blob();
    const imgURL = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = imgURL;
    img.style.width = "100%";
    img.style.marginTop = "20px";

    const trendGraphContainer = document.getElementById("trend-graph-container");
    trendGraphContainer.appendChild(img);
  } catch (error) {
    console.error("Error fetching trend graph image:", error);
    outputDiv.innerHTML += "<p>Error fetching trend graph image.</p>";
  }
}
