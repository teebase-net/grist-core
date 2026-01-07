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
## Run-time stage: The Hybrid Merge
################################################################################
FROM node:22-trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl libexpat1 libsqlite3-0 procps tini && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /persist/docs

# 1. Copy YOUR custom build first
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static-built /grist/static

# 2. SURGICAL GRAFT: Copy the Enterprise extensions BACK into your build
# This restores the Enterprise Admin Panel and login logic
COPY --from=enterprise-base /grist/_build/ext /grist/_build/ext
COPY --from=enterprise-base /grist/static/ext /grist/static/ext

# Copy other standard files
COPY --from=collector-py3 /usr/local/bin/python3.11 /usr/bin/python3.11
COPY --from=collector-py3 /usr/local/lib/python3.11 /usr/local/lib/python3.11
RUN ln -s /usr/bin/python3.11 /usr/bin/python && ln -s /usr/bin/python3.11 /usr/bin/python3 && ldconfig
COPY --from=sandbox /runsc /usr/bin/runsc
COPY package.json bower_components sandbox plugins static /grist/

# Ensure the grist user (1001) owns the hybrid build
RUN useradd -ms /bin/bash grist && chown -R grist:grist /grist
USER grist
WORKDIR /grist

ENV GRIST_ORG_IN_PATH=true \
    GRIST_SINGLE_PORT=true \
    NODE_ENV=production \
    TYPEORM_DATABASE=/persist/home.sqlite3

EXPOSE 8484
ENTRYPOINT ["./sandbox/docker_entrypoint.sh"]
CMD ["node", "./sandbox/supervisor.mjs"]
