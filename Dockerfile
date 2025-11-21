# ---- base image ----
FROM python:3.11-slim

# OS deps (libgomp1 is required by LightGBM) + curl for healthcheck
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

# sane python defaults
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# allow PORT override (default 8080)
ARG PORT=8080
ENV PORT=${PORT}

# workdir
WORKDIR /app

# install python deps first for better caching
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# download nltk data needed (stopwords/wordnet)
#RUN python -c "import nltk; nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('omw-1.4')"

# download nltk data needed (stopwords/wordnet) into a shared directory
RUN mkdir -p /usr/local/nltk_data && \
    python -m nltk.downloader -d /usr/local/nltk_data stopwords wordnet omw-1.4



# tell NLTK where the data is
ENV NLTK_DATA=/usr/local/nltk_data


# copy the rest of the project (includes model PKLs and flask_app/)
COPY . /app

# create non-root user
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

# expose + healthcheck
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/" || exit 1

# run with gunicorn, serving flask_app/app.py (module: app)
# make sure requirements.txt includes: gunicorn
CMD ["bash", "-lc", "gunicorn --chdir flask_app app:app --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 60"]
