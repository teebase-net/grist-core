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
# This ensures that any file you modify in the future is included.
# Note: This will not overwrite /grist/ext if 'ext' is in your .gitignore.
COPY . /grist

# 2. Re-compile the frontend.
# We explicitly export GRIST_EXT=ext so the build process links 
# your custom code with the Enterprise extensions found in the base image.
RUN yarn install --frozen-lockfile && \
    export GRIST_EXT=ext && \
    yarn run build:prod

################################################################################
## Run-time stage: Final Assembly
################################################################################
FROM base

# Copy the entire /grist directory from the builder.
# This includes your custom code, the compiled _build folder, 
# and the existing Enterprise 'ext' folder.
COPY --from=builder /grist /grist

# Set core environment variables for Enterprise operation.
ENV GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

# Set the working directory for the final container.
WORKDIR /grist

# Inherit the entrypoint and command from the base grist-ee image.
