FROM python:3.11-slim

# Install network utilities
RUN apt-get update && apt-get install -y \
    iputils-ping \
    traceroute \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
