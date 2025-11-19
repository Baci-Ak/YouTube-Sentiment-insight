// popup.js

// ====== CONFIG LAYERS (read this first) ======
//
// 1) Remote production config (S3)
//    - Public JSON file: https://yt-sentiment-config-baci.s3.amazonaws.com/config.json
//
// 2) Local config.js (NOT in Git)
//    - Contains YouTube API key + optional local API URL override.
//
// 3) Local fallback (full local mode)
//    - Uses http://localhost:5000 if nothing else works.
//

const S3_CONFIG_URL = "https://yt-sentiment-config-baci.s3.amazonaws.com/config.json";
const DEFAULT_LOCAL_API_URL = "http://localhost:5000";
const MAX_COMMENTS = 1000;

// ---- Sentiment label mapping ----
const SENTIMENT_LABELS = {
  "1": "Positive",
  "0": "Neutral",
  "-1": "Negative"
};

function formatSentimentLabel(value) {
  const label = SENTIMENT_LABELS[String(value)] || "Unknown";
  return `${label} (${value})`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const outputDiv = document.getElementById("output");

  // ---------- Load API URL from S3 ----------
  let apiUrl = DEFAULT_LOCAL_API_URL;
  let remoteConfigUsed = false;

  try {
    const resp = await fetch(S3_CONFIG_URL, { cache: "no-store" });
    if (resp.ok) {
      const cfg = await resp.json();
      if (cfg && cfg.API_URL) {
        apiUrl = cfg.API_URL;
        remoteConfigUsed = true;
      }
    }
  } catch (err) {
    console.warn("Could not reach S3 config, falling back to local config.js");
  }

  // ---------- Overlay local config.js (API key + optional local API URL override) ----------
  let apiKey = "";
  if (window.APP_CONFIG) {
    if (window.APP_CONFIG.API_URL) {
      apiUrl = window.APP_CONFIG.API_URL; // dev override
    }
    if (window.APP_CONFIG.YT_API_KEY) {
      apiKey = window.APP_CONFIG.YT_API_KEY;
    }
  }

  // Debug message if S3 config failed
  if (!remoteConfigUsed) {
    outputDiv.innerHTML =
      "<p style='color:#888; font-size:12px;'>Using local config settings (S3 config.json unavailable)</p>";
  }

  // Ensure YouTube API key exists
  if (!apiKey) {
    outputDiv.innerHTML +=
      "<p style='color:#ff6666;'>Missing YouTube API key in config.js</p>";
    return;
  }

  // -------- Load YouTube page details --------
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const url = tabs[0]?.url || "";
    const youtubeRegex = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;
    const match = url.match(youtubeRegex);

    if (!match) {
      outputDiv.innerHTML += "<p>This is not a valid YouTube video URL.</p>";
      return;
    }

    const videoId = match[1];
    outputDiv.innerHTML += `
      <div class="section-title">YouTube Video ID</div>
      <p>${videoId}</p>
      <p>Fetching comments…</p>
    `;

    // Fetch comments
    const comments = await fetchComments(videoId, apiKey, outputDiv);
    if (comments.length === 0) {
      outputDiv.innerHTML += "<p>No comments found.</p>";
      return;
    }

    outputDiv.innerHTML += `<p>Fetched ${comments.length} comments. Running ML prediction…</p>`;

    // ML predictions
    const predictions = await getSentimentPredictions(comments, apiUrl, outputDiv);
    if (!predictions) return;

    // Aggregate metrics
    const sentimentCounts = { "1": 0, "0": 0, "-1": 0 };
    const sentimentData = [];
    let totalSentimentScore = 0;

    predictions.forEach((item) => {
      const s = parseInt(item.sentiment);
      sentimentCounts[item.sentiment]++;
      totalSentimentScore += s;
      sentimentData.push({
        timestamp: item.timestamp,
        sentiment: s
      });
    });

    // Summary metrics
    const totalComments = comments.length;
    const uniqueCommenters = new Set(comments.map(c => c.authorId)).size;
    const totalWords = comments.reduce(
      (sum, c) => sum + c.text.split(/\s+/).filter(w => w).length,
      0
    );
    const avgWordLength = (totalWords / totalComments).toFixed(2);
    const avgSentimentScore = (totalSentimentScore / totalComments).toFixed(2);
    const normalizedSentimentScore = (((parseFloat(avgSentimentScore) + 1) / 2) * 10).toFixed(2);

    // ---------- Summary Section ----------
    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Comment Analysis Summary</div>
        <div class="metrics-container">
          <div class="metric"><div class="metric-title">Total Comments</div><div class="metric-value">${totalComments}</div></div>
          <div class="metric"><div class="metric-title">Unique Commenters</div><div class="metric-value">${uniqueCommenters}</div></div>
          <div class="metric"><div class="metric-title">Avg Comment Length</div><div class="metric-value">${avgWordLength} words</div></div>
          <div class="metric"><div class="metric-title">Avg Sentiment Score</div><div class="metric-value">${normalizedSentimentScore}/10</div></div>
        </div>
      </div>
    `;

    // ---------- Sentiment Pie Chart ----------
    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Sentiment Distribution</div>
        <p>Chart of positive, neutral and negative predictions.</p>
        <div id="chart-container"></div>
      </div>
    `;
    await fetchAndDisplayChart(sentimentCounts, apiUrl, outputDiv);

    // ---------- Trend Graph ----------
    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Sentiment Trend Over Time</div>
        <div id="trend-graph-container"></div>
      </div>
    `;
    await fetchAndDisplayTrendGraph(sentimentData, apiUrl, outputDiv);

    // ---------- Word Cloud ----------
    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Most Frequent Words</div>
        <div id="wordcloud-container"></div>
      </div>
    `;
    await fetchAndDisplayWordCloud(
      comments.map(c => c.text),
      apiUrl,
      outputDiv
    );

    // ---------- All Comments + Sentiment ----------
    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">All Comments with ML-Predicted Sentiment</div>
        <p style="font-size:12px; color:#aaa;">Sentiment: Positive (1), Neutral (0), Negative (-1)</p>
        <ul class="comment-list">
          ${predictions.map((item, index) => `
            <li class="comment-item">
              <span>${index + 1}. ${item.comment}</span><br>
              <span class="comment-sentiment">
                Sentiment: ${formatSentimentLabel(item.sentiment)}
              </span>
            </li>
          `).join("")}
        </ul>
      </div>
    `;
  });
});

// ======================= Helper Functions =======================

async function fetchComments(videoId, apiKey, outputDiv) {
  let comments = [];
  let pageToken = "";
  try {
    while (comments.length < MAX_COMMENTS) {
      const resp = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&pageToken=${pageToken}&key=${apiKey}`
      );
      const data = await resp.json();

      if (data.items) {
        data.items.forEach((item) => {
          const s = item.snippet.topLevelComment.snippet;
          comments.push({
            text: s.textOriginal,
            timestamp: s.publishedAt,
            authorId: s.authorChannelId?.value || "Unknown"
          });
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  } catch (e) {
    console.error("Error fetching comments:", e);
    outputDiv.innerHTML += "<p>Error fetching comments.</p>";
  }
  return comments;
}

async function getSentimentPredictions(comments, apiUrl, outputDiv) {
  try {
    const resp = await fetch(`${apiUrl}/predict_with_timestamps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments })
    });

    const result = await resp.json();
    if (resp.ok) return result;

    throw new Error(result.error);
  } catch (e) {
    console.error("Prediction error:", e);
    outputDiv.innerHTML += "<p>Error fetching sentiment predictions.</p>";
    return null;
  }
}

async function fetchAndDisplayChart(sentimentCounts, apiUrl, outputDiv) {
  try {
    const resp = await fetch(`${apiUrl}/generate_chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_counts: sentimentCounts })
    });

    if (!resp.ok) throw new Error();

    const blob = await resp.blob();
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.style.width = "100%";

    document.getElementById("chart-container").appendChild(img);
  } catch (e) {
    outputDiv.innerHTML += "<p>Error loading sentiment chart.</p>";
  }
}

async function fetchAndDisplayWordCloud(comments, apiUrl, outputDiv) {
  try {
    const resp = await fetch(`${apiUrl}/generate_wordcloud`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments })
    });

    if (!resp.ok) throw new Error();

    const blob = await resp.blob();
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.style.width = "100%";

    document.getElementById("wordcloud-container").appendChild(img);
  } catch (e) {
    outputDiv.innerHTML += "<p>Error loading word cloud.</p>";
  }
}

async function fetchAndDisplayTrendGraph(sentimentData, apiUrl, outputDiv) {
  try {
    const resp = await fetch(`${apiUrl}/generate_trend_graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentiment_data: sentimentData })
    });

    if (!resp.ok) throw new Error();

    const blob = await resp.blob();
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.style.width = "100%";

    document.getElementById("trend-graph-container").appendChild(img);
  } catch (e) {
    outputDiv.innerHTML += "<p>Error loading trend graph.</p>";
  }
}
