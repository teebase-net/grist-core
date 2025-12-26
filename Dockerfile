################################################################################
## STAGE 1: The Builder (Node 20)
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist

# 1. Copy your grist-core branch source
COPY . /grist

# 2. Extract Enterprise logic and OVERWRITE core stubs
# We bring in /ext, but we also overwrite the server 'create' logic 
# which is the gatekeeper for the login system.
COPY --from=gristlabs/grist-ee:latest /grist/ext /grist/ext
COPY --from=gristlabs/grist-ee:latest /grist/_build/stubs/app/server/lib/create.js /grist/app/server/lib/create.js

# 3. Install dependencies
RUN yarn install --frozen-lockfile --ignore-engines

# 4. Build the project
# This compiles your UI changes while the 'create' hook points to Enterprise.
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: Final Assembly
################################################################################
FROM gristlabs/grist-ee:latest

# Replace official build with our combined core+ee build
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/ext /grist/ext

# Ensure the Enterprise 'create' logic is the one being used in the final build
COPY --from=builder /grist/app/server/lib/create.js /grist/_build/app/server/lib/create.js || true

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

WORKDIR /grist
