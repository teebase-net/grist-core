################################################################################
## Base Stage: Start from the official Enterprise image
################################################################################
FROM gristlabs/grist-ee:latest AS base

################################################################################
## Build Stage: Full Branch Injection and Compilation
################################################################################
FROM base AS builder

USER root
WORKDIR /grist

# 1. Copy EVERYTHING from your selected branch into the image.
COPY . /grist

# 2. Re-compile the frontend.
# FIX: We add 'tsc --skipLibCheck' and ignore errors during the build 
# to bypass the lodash type-definition issues you encountered.
RUN yarn install --frozen-lockfile && \
    export GRIST_EXT=ext && \
    yarn run build:prod || (echo "Attempting build with type-check skip..." && \
    sed -i 's/tsc --build/tsc --skipLibCheck --build/g' buildtools/build.sh && \
    yarn run build:prod)

################################################################################
## Run-time stage: Final Assembly
################################################################################
FROM base

# Copy the entire /grist directory from the builder.
COPY --from=builder /grist /grist

# Set core environment variables for Enterprise operation.
ENV GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

WORKDIR /grist
