################################################################################
## Stage 1: Build your custom Core from fork
################################################################################
FROM node:22-trixie AS builder

WORKDIR /grist
COPY package.json yarn.lock /grist/
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# Build only your changes
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod

# Prepare the build artifacts for the swap
RUN mkdir -p /grist/dist && \
    cp -r _build/* /grist/dist/ 2>/dev/null || cp -r app /grist/dist/ && \
    cp -r static/* /grist/dist/static/ 2>/dev/null || true

################################################################################
## Stage 2: Final Run-time (The Inverted Graft)
################################################################################
# Start with the FULL official Enterprise image
FROM gristlabs/grist:latest

# We are now root briefly to perform the surgery
USER root

# 1. Overlay YOUR custom compiled code over the Enterprise core.
# This keeps the Enterprise 'ext' and 'node_modules' folders untouched.
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static

# 2. Re-apply permissions for the standard Grist user
RUN chown -R 1001:1001 /grist/_build /grist/static

# Switch back to the standard Grist user
USER 1001

# All Enterprise ENV variables are already set in the base image, 
# but we ensure the ones you need are present.
ENV \
  GRIST_ORG_IN_PATH=true \
  NODE_ENV=production

EXPOSE 8484
# Use the base image's existing ENTRYPOINT and CMD
