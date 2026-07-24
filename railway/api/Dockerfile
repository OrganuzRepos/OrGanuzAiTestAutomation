# FastAPI support service — Railway build.
# Build context = repo root; Dockerfile Path = railway/api/Dockerfile.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app ./app

# Railway injects PORT. Keep a fixed default so other services can reach this one
# over private networking at a stable api.railway.internal:8000 (set PORT=8000).
ENV PORT=8000
EXPOSE 8000

# Shell form so ${PORT} is expanded at runtime.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
