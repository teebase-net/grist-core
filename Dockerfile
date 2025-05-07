################################################################################
## Grist Dockerfile — includes full frontend build and custom patches
## Ensures files from app/, dist/, static/, and sandbox/ are all preserved
################################################################################

# --- 1. EXTENSION PLACEHOLDER ---
FROM scratch AS ext

# --- 2. FRONTEND BUILD STAGE ---
FROM node:22-bookworm AS builder

WORKDIR /grist

# Core package install
COPY package.json yarn.lock ./
RUN \
  yarn install --frozen-lockfile --verbose --network-timeout 600000 && \
  yarn global add --verbose --network-timeout 600000 node-gyp node-pre-gyp node-gyp-build node-gyp-build-optional-packages && \
  yarn install --prod --frozen-lockfile --modules-folder=node_modules_prod --verbose --network-timeout 600000

# Custom extensions from ext context
COPY --from=ext / /grist/ext
RUN \
  mkdir /node_modules && \
  cd /grist/ext && \
  [ -e package.json ] && yarn install --frozen-lockfile --modules-folder=/node_modules --verbose --network-timeout 600000 || true

# Copy full source
COPY . .

# Copy locales early to validate them
COPY static/locales static/locales

# ✅ Full frontend production build (incl. app/, dist/, static/)
RUN yarn run build:prod

# Optional pyodide sandbox build
RUN cd sandbox/pyodide && make setup

# --- 3. PYTHON 3.11 STAGE ---
FROM python:3.11-slim-bookworm AS collector-py3
COPY sandbox/requirements3.txt requirements3.txt
RUN \
  pip3 install setuptools==75.8.1 && \
  pip3 install -r requirements3.txt

# --- 4. PYTHON 2.7 LEGACY SUPPORT ---
FROM debian:buster-slim AS collector-py2
COPY sandbox/requirements.txt requirements.txt
RUN \
  apt update && \
  apt install -y --no-install-recommends python2 python-pip python-setuptools build-essential libxml2-dev libxslt-dev python-dev zlib1g-dev && \
  pip2 install wheel && \
  pip2 install -r requirements.txt && \
  find /usr/lib -iname "libffi.so.6*" -exec cp {} /usr/local/lib \;

# --- 5. GSANDBOX FETCH ---
FROM docker.io/gristlabs/gvisor-unprivileged:buster AS sandbox

# --- 6. FINAL IMAGE ---
FROM node:22-bookworm-slim

# Base runtime setup
RUN \
  apt-get update && \
  apt-get install -y --no-install-recommends curl libexpat1 libsqlite3-0 procps tini && \
  rm -rf /var/lib/apt/lists/*

RUN mkdir -p /persist/docs

# Node files
COPY --from=builder /node_modules /node_modules
COPY --from=builder /grist/node_modules_prod /grist/node_modules
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static-built
COPY --from=builder /grist/app /grist/app
COPY --from=builder /grist/dist /grist/dist
COPY --from=builder /grist/cli.sh /grist/cli

# Python 2
COPY --from=collector-py2 /usr/bin/python2.7 /usr/bin/python2.7
COPY --from=collector-py2 /usr/lib/python2.7 /usr/lib/python2.7
COPY --from=collector-py2 /usr/local/lib/python2.7 /usr/local/lib/python2.7
COPY --from=collector-py2 /usr/local/lib/libffi.so.6* /usr/local/lib/

# Python 3
COPY --from=collector-py3 /usr/local/bin/python3.11 /usr/bin/python3.11
COPY --from=collector-py3 /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=collector-py3 /usr/local/lib/libpython3.11.* /usr/local/lib/
RUN ln -s /usr/bin/python3.11 /usr/bin/python && ln -s /usr/bin/python3.11 /usr/bin/python3 && ldconfig

# Gvisor sandbox
COPY --from=sandbox /runsc /usr/bin/runsc

# Required files for running server
COPY package.json /grist/package.json
COPY bower_components /grist/bower_components
COPY sandbox /grist/sandbox
COPY plugins /grist/plugins
COPY static /grist/static

# Pyodide
COPY --from=builder /grist/sandbox/pyodide /grist/sandbox/pyodide

# Finalize static
RUN mv /grist/static-built/* /grist/static && rmdir /grist/static-built

# User setup
RUN useradd -ms /bin/bash grist
ENV GRIST_DOCKER_USER=grist \
    GRIST_DOCKER_GROUP=grist

# Env config
ENV \
  PYTHON_VERSION_ON_CREATION=3 \
  GRIST_ORG_IN_PATH=true \
  GRIST_HOST=0.0.0.0 \
  GRIST_SINGLE_PORT=true \
  GRIST_SERVE_SAME_ORIGIN=true \
  GRIST_DATA_DIR=/persist/docs \
  GRIST_INST_DIR=/persist \
  GRIST_SESSION_COOKIE=grist_core \
  GVISOR_FLAGS="-unprivileged -ignore-cgroups" \
  GRIST_SANDBOX_FLAVOR=unsandboxed \
  NODE_OPTIONS="--no-deprecation" \
  NODE_ENV=production \
  TYPEORM_DATABASE=/persist/home.sqlite3

WORKDIR /grist
EXPOSE 8484

ENTRYPOINT ["./sandbox/docker_entrypoint.sh"]
CMD ["node", "./sandbox/supervisor.mjs"]
