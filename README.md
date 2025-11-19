# 🎬 YouTube Sentiment Insight – End-to-End ML & Chrome Extension

This project is a **full production pipeline** that analyzes YouTube comments using machine learning, exposes predictions through a backend API, and visualizes insights in a **Chrome browser extension**.

It includes:

* 🧠 **ML model training + MLflow experiment tracking**
* 🔧 **Flask API served via Docker + AWS EC2**
* 🔄 **Automated CI/CD via GitHub Actions → AWS ECR → EC2**
* 🔍 **Chrome Extension** to analyze comments on any YouTube video
* 🌩️ **Dynamic configuration via S3**

---

# 📦 Project Features

### 🧠 Sentiment Model

* LightGBM model
* TF-IDF vectorizer
* Timestamp-aware predictions
* Preprocessing pipeline (lemmatization, stopwords, normalization)

### 📡 Backend API

* `/predict`
* `/predict_with_timestamps`
* `/generate_chart`
* `/generate_wordcloud`
* `/generate_trend_graph`

### 🧰 Frontend (Chrome Extension)

* Pulls config dynamically from **S3**
* Fetches YouTube comments via **YouTube Data API**
* Sends comments to backend API
* Displays:

  * Pie chart sentiment distribution
  * Trend graph over time
  * Word cloud
  * Summary metrics
  * comments with Machine Learning prediction sentiment
* No user data stored
* No ads, tracking, analytics

---

# 🛠️ Core Architecture

```
              ┌──────────────────────┐
              │      DVC Pipeline    │
              │  (data + training)   │
              └──────────┬───────────┘
                         │ logs + artifacts
                         ▼
               ┌──────────────────────┐
               │    MLflow Server     │
               │ EC2 (port 5000 open) │
               └──────────┬───────────┘
                         │  S3 artifacts
                         ▼
              ┌────────────────────────┐
              │        S3 Buckets      │
              │ (MLflow & config.json) │
              └────────────────────────┘
                         ▲
                         │
           ┌─────────────┴─────────────┐
           │         Backend API        │
           │    Docker on EC2 (8080)    │
           └─────────────┬─────────────┘
                         │
                         ▼
                ┌────────────────────┐
                │  Chrome Extension  │
                └────────────────────┘

```

---

# 🧩 1. Setup the Project Locally


### Clone repo and install dependencies:

```bash
git clone https://github.com/Baci-Ak/YouTube-Sentiment-insight.git
cd YouTube-Sentiment-insight

conda create -n youtube python=3.11 -y
conda activate youtube
pip install -r requirements.txt
```

---

# 🧪 2. DVC Pipeline – Data & Model Training
This project uses DVC to define and run the ML pipeline reproducibly.

## 2.1 Install DVC (if not already installed)

```bash
pip install dvc dvc[s3]
```
dvc[s3] is needed if you want to use S3 as a remote for data/models.


## 2.2 Run the Full pipeline

```bash

dvc init

dvc repro
```

This will:

1. Download + split data → data/raw/train.csv, data/raw/test.csv

2. Preprocess text → data/interim/train_processed.csv, test_processed.csv

3. Train TF-IDF + LightGBM model → lgbm_model.pkl, tfidf_vectorizer.pkl

4. Evaluate & log to MLflow (if MLFLOW_TRACKING_URI is set)

5. Write experiment_info.json used by model registration

You can visualize the pipeline graph:

```bash
dvc dag
```

## 2.3 DVC Remote (Optional, for Team Collaboration)
If you want to store data/model artifacts in S3:

```bash
dvc remote add -d myremote s3://your-dvc-bucket
dvc remote modify myremote endpointurl https://s3.amazonaws.com

# Push tracked data/models to remote
dvc push

```
---

# ☁️ 3. MLflow Experiment Tracking on AWS (Optional but Recommended)

MLflow lets you track training runs, parameters, metrics, and model artifacts.

This project supports **remote MLflow tracking** on AWS (EC2 + S3).

---

## 3.1 Create IAM User

1. AWS → IAM → Users → Create user
2. Name: `mlflow-admin`
3. Add permissions:

```
AmazonS3FullAccess
AmazonEC2FullAccess
```

4. Generate Access Keys
5. Save:

* AWS_ACCESS_KEY_ID
* AWS_SECRET_ACCESS_KEY

---

## 3.2 Create S3 Bucket for MLflow

AWS → S3 → Create Bucket:

* Name: `mlflow-bucket-yourname`
* Region: `us-east-1`

---

## 3.3 Launch EC2 for MLflow Tracking Server

* Ubuntu 22.04
* Security Group inbound rule:

| Port | Description |
| ---- | ----------- |
| 5000 | MLflow UI   |

---

## 3.4 Install MLflow on EC2

SSH:

```bash
ssh -i key.pem ubuntu@<EC2_PUBLIC_IP>
```

Install:

```bash
sudo apt update
sudo apt install python3-pip -y

pip install mlflow boto3 awscli
aws configure
```

---

## 3.5 Start MLflow Server

```bash
mkdir ~/mlflow
cd ~/mlflow

mlflow server \
  --host 0.0.0.0 \
  --port 5000 \
  --backend-store-uri sqlite:///mlflow.db \
  --default-artifact-root s3://mlflow-bucket-yourname
```

Your MLflow UI is now available at:

```
http://<EC2_PUBLIC_IP>:5000
```

---

## 3.6 Connect Your Local Machine to AWS MLflow

```bash
export MLFLOW_TRACKING_URI=http://<EC2_PUBLIC_IP>:5000
```

Now any training script will log results to AWS.

---

# 🐳 4. Backend Deployment (Flask API in Docker)

The backend is automatically deployed to EC2 via **GitHub Actions**.

Workflow:

```
GitHub → Build Docker Image → Push to AWS ECR → EC2 Runner → Pull + Restart Container
```

---

## 4.1 Create IAM User for CI/CD

Permissions:

```
AmazonEC2ContainerRegistryFullAccess
AmazonEC2FullAccess
```

Add these to GitHub Secrets:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
AWS_ECR_LOGIN_URI=210459439569.dkr.ecr.us-east-1.amazonaws.com
ECR_REPOSITORY_NAME=mlproj
```

---

## 4.2 EC2 Runner Setup

On EC2:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker
```

Then register as Self-Hosted Runner (GitHub → Settings → Actions → Runners).
```bash
setting>actions>runner>new self hosted runner> choose os> then run command one by one
```



### 4.2.1 example commands:

- Download

    1. create a folder:

    ```bash
    mkdir actions-runner && cd actions-runner
    ```

    2. ownload latest package:

    ```bash
    curl -o actions-runner-linux-x64-2.329.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz
    ```
    3. optional, validate the hash:

    ```bash
    echo "194f1e1e4bd02f80b7e9633fc546084d8d4e19f3928a324d512ea53430102e1d  actions-runner-linux-x64-2.329.0.tar.gz" | shasum -a 256 -c
    ```

   4.  extract the installer:

   ```bash
    tar xzf ./actions-runner-linux-x64-2.329.0.tar.gz

    ```

- Configure
    1. create the runner and start the configuration experience:
    
    ```bash 
    ./config.sh --url https://github.com/Baci-Ak/YouTube-Sentiment-insight --token a873RVG3NIKJE6H6BBABKY3JDQCMs
    ```

    2. last step, run it!
    ```bash
    ./run.sh
    ```


---



## 4.3 Docker Container (Automatic)

When you push to GitHub:

* CI builds image
* Pushes to ECR
* EC2 pulls and starts container

Your backend runs at:

```
http://<EC2_PUBLIC_IP>:8080
```

---

# 🌐 5. Dynamic Remote Configuration (S3)

Your Chrome extension does **not** contain hardcoded API URLs.

Instead it loads:

```
https://yt-sentiment-config-baci.s3.amazonaws.com/config.json
```

This JSON defines:

```json
{
  "API_URL": "http://54.242.62.191:8080",
  "YT_API_KEY": "YOUR_KEY"
}
```

This allows you to change environments instantly **without republishing** the extension.

---

# 🧩 6. Chrome Extension Setup (Local Development)

Inside `/yt-chrome-plugin-frontend`:

```bash
cd yt-chrome-plugin-frontend
```

Load into browser:

1. Visit `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select this folder

Your extension now loads:

* Comments from YouTube API
* Predictions from EC2 backend
* Config from S3
* Visualizations (pie chart, trend graph, word cloud)

---

# 🧼 7. Chrome Web Store Publishing

Before publishing, ZIP:

```bash
cd yt-chrome-plugin-frontend
zip -r ../yt-sentiment-extension-1.0.1.zip .
```

Upload to:
[https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)

You must provide:

* Screenshots
* Icon set
* Description
* Privacy practices
* Justifications for permissions
* INFORMED CONSENT that no user data is stored

Use privacy policy in `PRIVACY.md`.

---

# 🔒 8. Security Notes

* No user data is stored
* Comments are processed in-memory only
* Only public YouTube content is accessed
* API keys NOT stored inside extension
* All config loads from S3
* Backend CORS locked to extension

---

# 🟢 9. Running Backend Locally

```bash
uvicorn main:app --reload
```

---

# 🧭 10. Example API Usage (local)

```
POST http://localhost:8080/predict_with_timestamps
```

```json
{
  "comments": [
    {"text": "Great content!", "timestamp": "2024-01-01T00:00:00Z"},
    {"text": "Not so good", "timestamp": "2024-01-02T00:00:00Z"}
  ]
}
```

---

# 📚 11. Helpful Links

* YouTube API Key Setup
  [https://www.youtube.com/watch?v=i_FdiQMwKiw](https://www.youtube.com/watch?v=i_FdiQMwKiw)

* AWS EC2

* AWS ECR

* AWS S3

* MLflow docs

---