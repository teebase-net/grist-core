################################################################################
## STAGE 1: The Builder (Node 20)
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist

# 1. Copy your grist-core branch source
COPY . /grist

# 2. Bring in the Enterprise extensions (the /ext folder)
COPY --from=gristlabs/grist-ee:latest /grist/ext /grist/ext

# 3. Install dependencies
# We need these to build your custom UI
RUN yarn install --frozen-lockfile --ignore-engines

# 4. Build the project
# We set GRIST_EXT=ext to tell the build script to include the enterprise folder.
# This should link your custom UI with the Enterprise hooks.
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod

################################################################################
## STAGE 2: Final Assembly
################################################################################
FROM gristlabs/grist-ee:latest

# We replace the official app/static with our combined build results.
# IMPORTANT: We copy into the /grist/_build folder which is where the 
# Enterprise image expects the compiled code to live.
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static

# We also ensure the /ext folder we used during build is the one we use at runtime
COPY --from=builder /grist/ext /grist/ext

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

WORKDIR /grist
