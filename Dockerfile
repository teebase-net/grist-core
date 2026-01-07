################################################################################
## Stage 0: Grab the Official Enterprise Extensions
################################################################################
FROM gristlabs/grist:latest AS enterprise-base

################################################################################
## Stage 1: Javascript build stage
################################################################################
FROM node:22-trixie AS builder

WORKDIR /grist
COPY package.json yarn.lock /grist/
RUN yarn install --frozen-lockfile --verbose --network-timeout 600000

COPY tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# Build the UI
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod

# 4. Corrected path logic: 
# Webpack in grist-core usually builds into /grist/static or /grist/_build/core/static
RUN mkdir -p /grist/static-built && \
    if [ -d "_build/static" ]; then mv _build/static/* /grist/static-built/; \
    elif [ -d "static" ]; then cp -r static/* /grist/static-built/; \
    fi && \
    rm -rf /grist/static/locales

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

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl libexpat1 libsqlite3-0 procps tini && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /persist/docs

# 1. Copy your custom build
COPY --from=builder /grist/node_modules /grist/node_modules
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static-built /grist/static-built
COPY --from=builder /grist/app/cli.sh /grist/cli

# 2. THE GRAFT: Enterprise backend extensions
COPY --from=enterprise-base /grist/_build/ext /grist/_build/ext

# 3. Standard components
COPY --from=collector-py3 /usr/local/bin/python3.11 /usr/bin/python3.11
COPY --from=collector-py3 /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=collector-py3 /usr/local/lib/libpython3.11.* /usr/local/lib/
RUN ln -s /usr/bin/python3.11 /usr/bin/python && \
    ln -s /usr/bin/python3.11 /usr/bin/python3 && \
    ldconfig
COPY --from=sandbox /runsc /usr/bin/runsc

COPY package.json /grist/package.json
COPY bower_components /grist/bower_components
COPY sandbox /grist/sandbox
COPY plugins /grist/plugins
COPY static /grist/static
COPY --from=builder /grist/sandbox/pyodide /grist/sandbox/pyodide

# 5. Finalize the static directory
RUN cp -r /grist/static-built/* /grist/static/ && \
    rm -rf /grist/static-built

RUN useradd -ms /bin/bash grist && \
    chown -R grist:grist /grist /persist
USER grist
WORKDIR /grist

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
