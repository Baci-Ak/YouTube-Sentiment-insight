# Privacy Policy for YouTube Sentiment Insights

_Last updated: February 2025_

YouTube Sentiment Insights is a Chrome browser extension that analyzes the publicly available comments on YouTube videos and generates sentiment insights for the user. We take user privacy seriously. This document explains what data is collected, how it is used, and how your information is protected.

---

## 🔒 1. No Personal Data Collection

This extension **does not collect, store, transmit, or share any personal information** about the user who installs it.

We do **not** collect:
- Names, emails, or account details  
- Browsing history  
- IP addresses  
- Location  
- User activity (clicks, keystrokes, etc.)  
- Authentication information  
- Any identifying information  
- Any private communications  

The extension runs entirely on the client side except for sending **public YouTube comments** to a backend sentiment analysis API.

---

## 📝 2. What Data Is Processed

The extension fetches **publicly available YouTube comments** from the YouTube Data API.

This includes:
- Comment text  
- Comment timestamp  
- Public author channel ID (if provided by YouTube)

This data is:
- Fetched **directly from YouTube's API**  
- **Not linked to the extension user in any way**  
- **Not stored**, logged, profiled, or used for tracking  

Comments belong to YouTube users, not extension users.

---

## 🤖 3. How Data Is Used

Public comments are sent to our backend service for analysis:
- Sentiment classification  
- Word cloud generation  
- Trend analysis

The backend:
- **Does not store any comments**
- **Does not write to logs**
- **Does not create user profiles**
- Only returns analytical results

All processing is done **solely to provide the core feature** of the extension.

---

## 🔐 4. No Data Sharing

We do **not**:
- Sell data  
- Share data with third parties  
- Use data for advertising or marketing  
- Transfer data for analytics  
- Aggregate or store data long-term  

---

## 🧭 5. Permissions Justification

The extension uses the following Chrome permissions:

### `activeTab`
Needed to detect whether the user is on a YouTube video page so the extension can analyze comments.

### `tabs`
Used only to read the video URL (video ID).  
No browsing history or other tabs are accessed.

### `scripting`
Used to execute minimal client-side logic inside the current tab when required.

### Host permissions  
- `https://www.youtube.com/*` → Required to read the URL of the video.  
- `https://www.googleapis.com/*` → Required to fetch comments from the YouTube Data API.  
- `https://yt-sentiment-config-baci.s3.amazonaws.com/*` → Required to fetch dynamic API configuration.  
- `http://54.242.62.191:8080/*` → Backend API endpoint used only for sentiment analysis.

These hosts are used **only to implement the extension’s single purpose**.

---

## 📁 6. Data Retention

We **do not retain any user data**.

All processing is:
- Temporary  
- In-memory  
- Deleted immediately after generating results  

---

## 📦 7. Changes to This Policy

This policy may be updated to reflect improvements or new regulatory requirements. Updates will be posted in this file.

---

## 📬 8. Contact

For questions or concerns, contact:

**Baci Data Science Lab**  
Email: baci.datascience@gmail.com  

---

# Summary

✔ No personal data collected  
✔ No tracking  
✔ No selling or sharing data  
✔ Only public comments are analyzed  
✔ All permissions justified  
✔ Fully compliant with Chrome Web Store policies  

