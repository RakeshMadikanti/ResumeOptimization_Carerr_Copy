# Use Node.js 20 on Debian Bookworm (slim version)
FROM node:20-bookworm-slim

# Install Python 3 and Pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create and set working directory
WORKDIR /app

# 1. Install Python Dependencies
# We do this first or alongside to cache layers effectively, but for simplicity we do it here.
# It's often safer to use a virtual environment, but for a container global install is often acceptable.
# However, Debian Bookworm enforces PEP 668, so we MUST use a venv or --break-system-packages.
# We will use a venv and add it to PATH.
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Install Node Dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Copy Source Code
COPY . .

# 4. Build Next.js Application
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 5. Production Setup
# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
