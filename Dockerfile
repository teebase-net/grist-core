# ==============================================================================
# STAGE 0: Official Enterprise Source
# ==============================================================================
FROM gristlabs/grist:latest AS enterprise-source

# ==============================================================================
# STAGE 1: Builder (Your Fork)
# ==============================================================================
FROM node:22-trixie AS builder

WORKDIR /grist
COPY package.json yarn.lock /grist/
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy fork source files
COPY tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# Build the production JS/CSS bundles
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod

# ==============================================================================
# STAGE 2: Final Run-time (Full Enterprise Hybrid)
# ==============================================================================
# Use the base enterprise source first
FROM gristlabs/grist:latest AS enterprise-source

# Create builder stage
FROM node:22-trixie AS builder

WORKDIR /grist
# Copy the official source first
COPY package.json yarn.lock /grist/
RUN yarn install --frozen-lockfile --network-timeout 600000

# Now copy the enterprise-generated files first
COPY --from=enterprise-source /grist/_build/ext /grist/_build/ext

# Then copy your custom files
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# Build the production JS/CSS bundles
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod

# Copy algorithms that were explicitly built
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static

# Ownership fix for the Grist user
RUN chown -R 1001:1001 /grist/_build /grist/static

# Switch to a non-root user for security
USER 1001
ENV NODE_ENV=production
ENV GRIST_ORG_IN_PATH=true

EXPOSE 8484
8484
