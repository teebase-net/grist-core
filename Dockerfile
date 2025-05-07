################################################################################
## The Grist source can be extended. This is a stub that can be overridden
## from command line, as:
##   docker buildx build -t ... --build-context=ext=<path> .
## The code in <path> will then be built along with the rest of Grist.
################################################################################
FROM scratch AS ext

################################################################################
## Javascript build stage
################################################################################

FROM node:22-bookworm AS builder

# Install all node dependencies.
WORKDIR /grist
COPY package.json yarn.lock /grist/

# ✅ MOD TEEBASE: Add global gyp tools before prod install (needed for sqlite3 build).
RUN \
  yarn install --frozen-lockfile --verbose --network-timeout 600000 && \
  yarn global add --verbose --network-timeout 600000 node-gyp node-pre-gyp node-gyp-build node-gyp-build-optional-packages && \
  yarn install --prod --frozen-lockfile --modules-folder=node_modules_prod --verbose --network-timeout 600000

# Install any extra node dependencies (optional).
COPY --from=ext / /grist/ext
RUN \
 mkdir /node_modules && \
 cd /grist/ext && \
 { if [ -e package.json ] ; then yarn install --frozen-lockfile --modules-folder=/node_modules --verbose --network-timeout 600000 ; fi }

# ✅ MOD TEEBASE: Copy everything in one shot (your custom-ui branch source should include patches).
COPY . .

# Build frontend
RUN yarn run build:prod
RUN rm -rf /grist/static/locales

# Optional pyodide setup
COPY sandbox/pyodide /grist/sandbox/pyodide
COPY sandbox/requirements3.txt /grist/sandbox/requirements3.txt
RUN \
  cd /grist/sandbox/pyodide && make setup

################################################################################
## Python collection stage
################################################################################

FROM python:3.11-slim-bookworm AS collector-py3

# ✅ Fix: explicitly place file where RUN command expects it
COPY sandbox/requirements3.txt /requirements.txt

RUN \
  pip3 install setuptools==75.8.1 && \
  pip3 install -r /requirements.txt

FROM debian:buster-slim AS collector-py2

# ✅ Fix: same treatment for Python 2 to avoid the same issue
COPY sandbox/requirements.txt /requirements.txt

RUN \
  apt update && \
  apt install -y --no-install-recommends python2 python-pip python-setuptools \
  build-essential libxml2-dev libxslt-dev python-dev zlib1g-dev && \
  pip2 install wheel && \
  pip2 install -r /requirements.txt && \
  find /usr/lib -iname "libffi.so.6*" -exec cp {} /usr/local/lib \;


################################################################################
## Sandbox collection stage
################################################################################

FROM docker.io/gristlabs/gvisor-unprivileged:buster AS sandbox

################################################################################
## Final runtime stage
################################################################################

FROM node:22-bookworm-slim

RUN \
  apt-get update && \
  apt-get install -y --no-install-recommends curl libexpat1 libsqlite3-0 procps tini && \
  rm -rf /var/lib/apt/lists/*

# ✅ MOD TEEBASE: Optional but standard - create volume target
RUN mkdir -p /persist/docs

# Copy built artifacts from builder stage
COPY --from=builder /node_modules /node_modules
COPY --from=builder /grist/node_modules_prod /grist/node_modules
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static-built
COPY --from=builder /grist/app/cli.sh /grist/cli
COPY --from=builder /grist/app /grist/app

# Python 2 runtime
COPY --from=collector-py2 /usr/bin/python2.7 /usr/bin/python2.7
COPY --from=collector-py2 /usr/lib/python2.7 /usr/lib/python2.7
COPY --from=collector-py2 /usr/local/lib/python2.7 /usr/local/lib/python2.7
COPY --from=collector-py2 /usr/local/lib/libffi.so.6* /usr/local/lib/

# Python 3 runtime
COPY --from=collector-py3 /usr/local/bin/python3.11 /usr/bin/python3.11
COPY --from=collector-py3 /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=collector-py3 /usr/local/lib/libpython3.11.* /usr/local/lib/
RUN \
  ln -s /usr/bin/python3.11 /usr/bin/python && \
  ln -s /usr/bin/python3.11 /usr/bin/python3 && \
  ldconfig

COPY --from=sandbox /runsc /usr/bin/runsc

# Remaining project files
COPY package.json /grist/package.json
COPY bower_components /grist/bower_components
COPY sandbox /grist/sandbox
COPY plugins /grist/plugins
COPY static /grist/static
COPY --from=builder /grist/sandbox/pyodide /grist/sandbox/pyodide

# Finalize static directory
RUN \
  mv /grist/static-built/* /grist/static && \
  rmdir /grist/static-built

# Add a user to de-escalate from root
RUN useradd -ms /bin/bash grist

# ✅ MOD TEEBASE: Use standard runtime and same env vars
ENV GRIST_DOCKER_USER=grist \
    GRIST_DOCKER_GROUP=grist \
    GRIST_HOST=0.0.0.0 \
    GRIST_SINGLE_PORT=true \
    GRIST_SERVE_SAME_ORIGIN=true \
    GRIST_SESSION_COOKIE=grist_core \
    GRIST_DATA_DIR=/persist/docs \
    GRIST_INST_DIR=/persist \
    PYTHON_VERSION_ON_CREATION=3 \
    GRIST_ORG_IN_PATH=true \
    GRIST_SANDBOX_FLAVOR=unsandboxed \
    GVISOR_FLAGS="-unprivileged -ignore-cgroups" \
    NODE_OPTIONS=--no-deprecation \
    NODE_ENV=production \
    TYPEORM_DATABASE=/persist/home.sqlite3

WORKDIR /grist
EXPOSE 8484

ENTRYPOINT ["./sandbox/docker_entrypoint.sh"]
CMD ["node", "./sandbox/supervisor.mjs"]
