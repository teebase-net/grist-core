################################################################################
## STAGE 1: The Builder (Node 20)
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist

# 1. Copy your grist-core branch
COPY . /grist

# 2. Extract Enterprise logic properly
# We use a temporary container to extract the EE files so we can use shell logic
RUN mkdir -p /tmp/ee-files
COPY --from=gristlabs/grist-ee:latest /grist/ext /grist/ext

# Use a RUN command (not COPY) to move the internal EE hooks into your core source.
# This replaces the "stubs" with the real Enterprise entry points.
RUN cp -f /grist/ext/app/server/lib/create.js /grist/app/server/lib/create.ts 2>/dev/null || true

# 3. Install dependencies
RUN yarn install --frozen-lockfile --ignore-engines

# 4. Build the project as Enterprise
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: Final Assembly
################################################################################
FROM gristlabs/grist-ee:latest

# Overwrite the base EE build with your custom core build
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/ext /grist/ext

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

WORKDIR /grist
