################################################################################
## STAGE 1: The Builder
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist
COPY . /grist

# 1. NEW STEP: Pull the Enterprise extensions into the builder 
# so the compiler can see them and satisfy the 'getAppSettings' dependencies.
COPY --from=gristlabs/grist-ee:latest /grist/ext /grist/ext

RUN yarn install --frozen-lockfile --ignore-engines

# 2. Build with extensions present
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: The Final Image
################################################################################
FROM gristlabs/grist-ee:latest

# Copy the entire build output AND the re-linked extensions
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/ext /grist/ext

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true

WORKDIR /grist
