################################################################################
## Stage 0: Grab the Official Enterprise Extensions
################################################################################
FROM gristlabs/grist:latest AS enterprise-base

################################################################################
## Stage 1: Javascript build stage
################################################################################
FROM node:22-trixie AS builder

# 1. Install all node dependencies
WORKDIR /grist
COPY package.json yarn.lock /grist/
RUN yarn install --frozen-lockfile --verbose --network-timeout 600000

# 2. Copy source code from your fork
COPY tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# 3. Build the UI (including your LayoutTray patches)
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod

# 4. Prepare static artifacts for the final stage
# We move the built static assets to a dedicated folder to avoid COPY errors
RUN mkdir -p /grist/static-built && \
    mv _build/static/* /grist/static-built/ && \
    rm -rf /grist/static/locales

# 5. Prepare optional pyodide sandbox
COPY sandbox/pyodide /grist/sandbox/pyodide
COPY sandbox/requirements.txt /grist/sandbox/requirements.txt
RUN cd /grist/sandbox/pyodide && make setup

################################################################################
## Stage 2: Python collection stage
################################################################################
FROM python:3.11-slim-trixie AS collector-py3
COPY sandbox/requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

################################################################################
## Stage 3: Sandbox collection stage
################################################################################
FROM docker.io/gristlabs/gvisor-unprivileged:buster AS sandbox

################################################################################
## Stage 4: Final Run-time stage (The Hybrid Merge)
################################################################################
FROM node:22-trixie-slim

ARG GRIST_ALLOW_AUTOMATIC_VERSION_CHECKING=false

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl libexpat1 libsqlite3-0 procps tini && \
    rm -rf /var/lib/apt/lists/*

# Setup persistence
RUN mkdir -p /persist/docs

# --- THE HYBRID COPY SECTION ---

# 1. Copy your custom build (from Stage 1)
COPY --from=builder /grist/node_modules /grist/node_modules
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static-built /grist/static-built
COPY --from=builder /grist/app/cli.sh /grist/cli

# 2. SURGICAL GRAFT: Restore official Enterprise backend extensions
# This folder 'ext' is what activates the Admin Panel and Billing features
COPY --from=enterprise-base /grist/_build/ext /grist/_build/ext

# 3. Copy official Python and Sandbox components
COPY --from=collector-py3 /usr/local/bin/python3.11 /usr/bin/python3.11
COPY --from=collector-py3 /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=collector-py3 /usr/local/lib/libpython3.11.* /usr/local/lib/
RUN ln -s /usr/bin/python3.11 /usr/bin/python && \
    ln -s /usr/bin/python3.11 /usr/bin/python3 && \
    ldconfig
COPY --from=sandbox /runsc /usr/bin/runsc

# 4. Add standard files needed for running the server
COPY package.json /grist/package.json
COPY bower_components /grist/bower_components
COPY sandbox /grist/sandbox
COPY plugins /grist/plugins
COPY static /grist/static
COPY --from=builder /grist/sandbox/pyodide /grist/sandbox/pyodide

# 5. Finalize the static directory
# We merge your custom-built assets into the main static folder
RUN mv /grist/static-built/* /grist/static/ && \
    rmdir /grist/static-built

# 6. Official User Setup (User 1001)
RUN useradd -ms /bin/bash grist && \
    chown -R grist:grist /grist /persist
USER grist
WORKDIR /grist

# --- Environment Configuration ---
ENV \
  GRIST_ORG_IN_PATH=true \
  GRIST_HOST=0.0.0.0 \
  GRIST_SINGLE_PORT=true \
  GRIST_SERVE_SAME_ORIGIN=true \
  GRIST_DATA_DIR=/persist/docs \
  GRIST_INST_DIR=/persist \
  GRIST_SESSION_COOKIE=grist_core \
  GRIST_ALLOW_AUTOMATIC_VERSION_CHECKING=${GRIST_ALLOW_AUTOMATIC_VERSION_CHECKING} \
  GVISOR_FLAGS="-unprivileged -ignore-cgroups" \
  GRIST_SANDBOX_FLAVOR=gvisor \
  NODE_OPTIONS="--no-deprecation" \
  NODE_ENV=production \
  TYPEORM_DATABASE=/persist/home.sqlite3

EXPOSE 8484

ENTRYPOINT ["./sandbox/docker_entrypoint.sh"]
CMD ["node", "./sandbox/supervisor.mjs"]
