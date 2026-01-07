################################################################################
## Stage 1: Official Enterprise as the Source of Truth
################################################################################
FROM gristlabs/grist:latest AS enterprise-source

################################################################################
## Stage 2: Build your Custom Fork (The Skin)
################################################################################
FROM node:22-trixie AS builder

WORKDIR /grist
COPY package.json yarn.lock /grist/
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy source from your fork (/opt/grist/dev)
COPY tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# Build the custom UI (The Layout Tray, etc.)
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod

################################################################################
## Stage 3: Final Hybrid Enterprise Image
################################################################################
FROM gristlabs/grist:latest

# We return to the official image as the base to ensure all OS dependencies
# and Enterprise node_modules are 100% correct.
USER root

# 1. Overlay YOUR custom compiled core code
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static

# 2. CRITICAL: Restore the Enterprise Backend that Stage 2 would have wiped
# This ensures /grist/_build/ext (Enterprise code) exists in the final image.
COPY --from=enterprise-source /grist/_build/ext /grist/_build/ext

# 3. Ensure permissions are set for the Grist user (1001)
RUN chown -R 1001:1001 /grist/_build /grist/static

USER 1001
ENV NODE_ENV=production
ENV GRIST_ORG_IN_PATH=true

# Grist default port
EXPOSE 8484
