# =============================================================================
# 📦 Multi-stage Dockerfile for Grist — Custom-UI Branch (Teebase)
# Based on: https://github.com/gristlabs/grist-core/blob/master/Dockerfile
# =============================================================================

################################################################################
## JavaScript build stage
################################################################################

FROM node:22-bookworm AS builder

WORKDIR /grist

# Install node modules (dev + prod) and global build tools
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && \
    yarn global add node-gyp node-pre-gyp node-gyp-build node-gyp-build-optional-packages && \
    yarn install --prod --frozen-lockfile --modules-folder=node_modules_prod

# Copy full Grist source
COPY . .

# Run full production build
RUN yarn run build:prod

# Optional cleanup
RUN rm -rf /grist/static/locales


################################################################################
## Final runtime stage
################################################################################

FROM node:22-bookworm-slim

# Install minimal required packages
RUN apt-get update && apt-get install -y \
    curl libexpat1 libsqlite3-0 procps tini && \
    rm -rf /var/lib/apt/lists/*

# ✅ Create the grist user (fixes missing user error)
RUN useradd -ms /bin/bash grist
ENV GRIST_DOCKER_USER=grist \
    GRIST_DOCKER_GROUP=grist

WORKDIR /grist

# Copy only runtime files from builder
COPY --from=builder /grist/node_modules_prod /grist/node_modules
COPY --from=builder /grist/app /grist/app
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/package.json /grist/package.json

# Runtime env vars
ENV \
  NODE_ENV=production \
  NODE_OPTIONS=--no-deprecation \
  GRIST_DATA_DIR=/persist/docs \
  GRIST_INST_DIR=/persist \
  GRIST_HOST=0.0.0.0 \
  GRIST_SINGLE_PORT=true \
  GRIST_SERVE_SAME_ORIGIN=true \
  GRIST_SESSION_COOKIE=grist_core \
  GRIST_ORG_IN_PATH=true

EXPOSE 8484

# Start the Grist server
CMD ["node", "./app/server/server.js"]
