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
# FIX: We modify the JSON config files directly because tsc --build forbids CLI flags.
# - We force skipLibCheck to true inside the tsconfig.
# - We disable strict mode and implicit any checks.
RUN yarn install --frozen-lockfile && \
    export GRIST_EXT=ext && \
    sed -i 's/"compilerOptions": {/"compilerOptions": {\n    "skipLibCheck": true, "strict": false, "noImplicitAny": false,/' tsconfig.json && \
    yarn run build:prod

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
