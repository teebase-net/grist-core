################################################################################
## STAGE 1: The Builder (Node 20 to satisfy modern engine requirements)
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist

# 1. Copy your branch source
COPY . /grist

# 2. Install ALL dependencies (Dev + Prod)
# We use --ignore-engines only as a secondary safety; Node 20 matches minimatch's needs.
RUN yarn install --frozen-lockfile --ignore-engines

# 3. Perform the build
# This generates the compiled JS in _build/ and assets in static/
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: The Final Image (Official Enterprise Base)
################################################################################
FROM gristlabs/grist-ee:latest

# Replace official frontend assets with your custom-built ones.
# We preserve the Enterprise 'ext' and 'core' logic from the base image.
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static

# Update the version stamp
ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true

WORKDIR /grist
