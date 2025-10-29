FROM python:3.11-slim

# Install network utilities and dependencies
RUN apt-get update && apt-get install -y \
    iputils-ping \
    traceroute \
    dnsutils \
    curl \
    wget \
    iperf3 \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Speedtest CLI
RUN curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash && \
    apt-get update && \
    apt-get install -y speedtest

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "main.py"]
