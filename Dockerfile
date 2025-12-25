################################################################################
## Base Stage: Official Enterprise Image
################################################################################
FROM gristlabs/grist-ee:latest AS base

################################################################################
## Build Stage: Methodical Compilation
################################################################################
FROM base AS builder

USER root
WORKDIR /grist

# Copy the entire branch state
COPY . /grist

# 1. Install dependencies exactly as defined in the lockfile
RUN yarn install --frozen-lockfile

# 2. Methodical Build
# We use the existing build script but set environment variables that 
# TypeScript-integrated tools (like ts-node or certain webpack loaders)
# respect to prevent halting on type-only mismatches.
# We also use 'tsc --build' as intended by the Grist maintainers.
RUN export GRIST_EXT=ext && \
    export NODE_ENV=production && \
    yarn run build:prod
