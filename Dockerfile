################################################################################
## STAGE 1: The Builder
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist

# 1. Start with your grist-core branch
COPY . /grist

# 2. Graft Enterprise logic into the Core source
# We take the pre-compiled Enterprise stubs and force them into our source tree.
# This ensures that when FlexServer starts, it sees the EE version of 'create'.
COPY --from=gristlabs/grist-ee:latest /grist/ext /grist/ext
COPY --from=gristlabs/grist-ee:latest /grist/_build/stubs/app/server/lib/create.js /grist/app/server/lib/create.ts || true

# 3. Install dependencies
RUN yarn install --frozen-lockfile --ignore-engines

# 4. Build the project as Enterprise
# The GRIST_EXT flag is the signal to the build script to link everything.
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: Final Assembly
################################################################################
FROM gristlabs/grist-ee:latest

# Overwrite the official build with our patched build
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/ext /grist/ext

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production \
    GRIST_FORCE_LOGIN=true

WORKDIR /grist
