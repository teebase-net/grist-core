################################################################################
## STAGE 1: The Builder (Node 20)
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist

# 1. Copy your grist-core branch source first
COPY . /grist

# 2. Pull the Enterprise extensions AND the Enterprise core-overwrites
# We need more than just /ext; we need the EE-specific core files.
COPY --from=gristlabs/grist-ee:latest /grist/ext /grist/ext
COPY --from=gristlabs/grist-ee:latest /grist/app/server/lib/AppSettings.js /grist/app/server/lib/AppSettings.js || true

# 3. Install dependencies
RUN yarn install --frozen-lockfile --ignore-engines

# 4. Build the merged project
# Setting GRIST_EXT=ext is the trigger that tells Grist to build as Enterprise.
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: Final Assembly
################################################################################
FROM gristlabs/grist-ee:latest

# Copy the results of our core+ee marriage
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/ext /grist/ext

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

WORKDIR /grist
