################################################################################
## STAGE 1: Build your custom UI from Core Source
################################################################################
FROM node:20-bookworm AS builder

USER root
WORKDIR /grist
COPY . /grist

RUN yarn install --frozen-lockfile --ignore-engines

# We only care about the client-side build for the UI changes
RUN FETCH_EXTERNAL_PLUGINS=false \
    NODE_ENV=production \
    yarn run build:prod

################################################################################
## STAGE 2: Overlay your UI onto the Official Enterprise Image
################################################################################
FROM gristlabs/grist-ee:latest

# 1. We keep the EE server logic (_build/app/server) UNTOUCHED.
# 2. We only overwrite the Client UI and Static assets.
COPY --from=builder /grist/_build/app/client /grist/_build/app/client
COPY --from=builder /grist/_build/app/common /grist/_build/app/common
COPY --from=builder /grist/static /grist/static

ARG DISPLAY_VERSION
ENV GRIST_VERSION_TAG=$DISPLAY_VERSION \
    GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true

WORKDIR /grist
