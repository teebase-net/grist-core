# =============================================================================
# 📦 Multi-stage Dockerfile for Grist — Custom-UI Branch (Teebase)
# Based on: https://github.com/gristlabs/grist-core/blob/master/Dockerfile
# =============================================================================

################################################################################
## JavaScript build stage
################################################################################

FROM node:22-bookworm AS builder

WORKDIR /grist

# Install node modules
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && \
    yarn global add node-gyp node-pre-gyp node-gyp-build node-gyp-build-optional-packages && \
    yarn install --prod --frozen-lockfile --modules-folder=node_modules_prod

# Copy full Grist source (including sandbox!)
COPY . .

# Build frontend assets
RUN yarn run build:prod

# Clean up unused locale files
RUN rm -rf /grist/static/locales

################################################################################
## Runtime stage
################################################################################

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    curl libexpat1 libsqlite3-0 procps tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /grist

# Copy runtime components from builder
COPY --from=builder /grist/node_modules_prod /grist/node_modules
COPY --from=builder /grist/app /grist/app
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/package.json /grist/package.json
COPY --from=builder /grist/sandbox /grist/sandbox

# ✅ Restore missing file that caused your crash:
ENTRYPOINT ["./sandbox/docker_entrypoint.sh"]
CMD ["node", "./sandbox/supervisor.mjs"]

# Environment defaults (can be overridden in docker-compose)
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
