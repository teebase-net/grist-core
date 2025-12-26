################################################################################
## STAGE 1: Build your custom UI from Core Source
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist
COPY . /grist

RUN yarn install --frozen-lockfile --ignore-engines

# Build with PRO enabled so the UI generates the correct Enterprise routes
RUN FETCH_EXTERNAL_PLUGINS=false \
    NODE_ENV=production \
    GRIST_PRO=true \
    yarn run build:prod

################################################################################
## STAGE 2: Overlay your UI onto the Official Enterprise Image
################################################################################
FROM gristlabs/grist-ee:latest

# Surgical Overlay
COPY --from=builder /grist/_build/app/client /grist/_build/app/client
COPY --from=builder /grist/_build/app/common /grist/_build/app/common
COPY --from=builder /grist/static /grist/static

# Set correct runtime flags
ENV GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    GRIST_UI_FEATURES="billing,multiSite,themes"

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION

WORKDIR /grist
