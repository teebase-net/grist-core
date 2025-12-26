################################################################################
## STAGE 1: The Builder
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist

# 1. Start with your custom grist-core source
COPY . /grist

# 2. Extract ALL Enterprise compiled logic
# We copy the entire _build folder from EE into a temporary location
COPY --from=gristlabs/grist-ee:latest /grist/_build /tmp/ee_build
COPY --from=gristlabs/grist-ee:latest /grist/ext /grist/ext

# 3. Graft: Overwrite your local "stubs" with the real EE compiled files
# This fixes the 'getAppSettings' and 'getLoginSystem' errors by replacing
# open-source placeholders with Enterprise logic.
RUN cp -r /tmp/ee_build/stubs/app/server/lib/* /grist/app/server/lib/ 2>/dev/null || true

# 4. Install dependencies and Build
RUN yarn install --frozen-lockfile --ignore-engines
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: Final Assembly
################################################################################
FROM gristlabs/grist-ee:latest

# Overwrite the base EE with your custom-built UI and merged logic
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/ext /grist/ext

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

WORKDIR /grist
