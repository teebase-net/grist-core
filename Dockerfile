################################################################################
## STAGE 1: The Builder (Full Node environment with all compilers)
################################################################################
FROM node:18-bookworm AS builder

USER root
WORKDIR /grist

# 1. Copy your branch source
COPY . /grist

# 2. Install EVERYTHING (including DevDependencies)
# We do not use --production so that we get 'ts-interface-builder' and 'tsc'
RUN yarn install --frozen-lockfile

# 3. Perform the build
# We set GRIST_EXT=ext to ensure the build expects the enterprise hooks
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: The Final Image (Official Enterprise Base)
################################################################################
FROM gristlabs/grist-ee:latest

# We replace the Enterprise 'app' and 'static' folders with your compiled ones
# but we leave the Enterprise 'ext' folder alone.
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static

# Update the version stamp if provided
ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true

WORKDIR /grist
