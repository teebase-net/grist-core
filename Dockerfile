################################################################################
## Stage 0: Grab the Official Enterprise Extensions
################################################################################
FROM gristlabs/grist:latest AS enterprise-base

################################################################################
## Javascript build stage
################################################################################
FROM node:22-trixie AS prod-builder
WORKDIR /grist
COPY package.json yarn.lock /grist/
RUN yarn install --prod --frozen-lockfile --verbose --network-timeout 600000

FROM prod-builder AS builder
RUN yarn install --frozen-lockfile --verbose --network-timeout 600000

# Copy your custom source code (including your LayoutTray patches)
COPY tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# BUILD YOUR CUSTOM CORE
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod
RUN rm -rf /grist/static/locales

# Prepare pyodide
COPY sandbox/pyodide /grist/sandbox/pyodide
COPY sandbox/requirements.txt /grist/sandbox/requirements.txt
RUN cd /grist/sandbox/pyodide && make setup

################################################################################
## Python & Sandbox stages (Unchanged)
################################################################################
FROM python:3.11-slim-trixie AS collector-py3
COPY sandbox/requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

FROM docker.io/gristlabs/gvisor-unprivileged:buster AS sandbox

################################################################################
## Run-time stage: The Hybrid Merge (custom-ui + enterprise extensions)
################################################################################
FROM node:22-trixie-slim

ARG GRIST_ALLOW_AUTOMATIC_VERSION_CHECKING=false

# 1. Install official dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl libexpat1 libsqlite3-0 procps tini && \
    rm -rf /var/lib/apt/lists/*

# 2. Setup persistence directories
RUN mkdir -p /persist/docs

# 3. HYBRID COPY: Custom UI + Enterprise Backend
# Copy YOUR custom build from the builder stage
COPY --from=builder /node_modules /node_modules
COPY --from=prod-builder /grist/node_modules /grist/node_modules
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static-built /grist/static-built
COPY --from=builder /grist/app/cli.sh /grist/cli

# SURGICAL GRAFT: Restore official Enterprise backend extensions
# This folder 'ext' is what activates the Admin Panel and Billing features
COPY --from=enterprise-base /grist/_build/ext /grist/_build/ext

# 4. Copy official Python and Sandbox components
COPY --from=collector-py3 /usr/local/bin/python3.11 /usr/bin/python3.11
COPY --from=collector-py3 /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=collector-py3 /usr/local/lib/libpython3.11.* /usr/local/lib/
RUN ln -s /usr/bin/python3.11 /usr/bin/python && \
    ln -s /usr/bin/python3.11 /usr/bin/python3 && \
    ldconfig
COPY --from=sandbox /runsc /usr/bin/runsc

# 5. Add configuration and runtime scripts
COPY package.json /grist/package.json
COPY bower_components /grist/bower_components
COPY sandbox /grist/sandbox
COPY plugins /grist/plugins
COPY static /grist/static
COPY --from=builder /grist/sandbox/pyodide /grist/sandbox/pyodide

# 6. Finalize the static directory (Merging your build into static)
RUN mv /grist/static-built/* /grist/static && \
    rmdir /grist/static-built

# 7. Official User Setup (User 1001 for Grist)
RUN useradd -ms /bin/bash grist && \
    chown -R grist:grist /grist /persist
USER grist
WORKDIR /grist

# 8. Official Environment Variables
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
