# Dockerfile building the Flask backend with simulation fallback
FROM python:3.11-slim

# Set workdir and copy dependency manifests
WORKDIR /app
COPY requirements.txt requirements.txt

# Install dependencies system-wide
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend backend
COPY frontend frontend
COPY tests tests
COPY data data

# Default environment variables (simulation safe)
ENV FLASK_APP=backend.app
ENV TRAIN_ON_IMPORT=1

EXPOSE 5000

CMD ["python", "-m", "backend.app"]
