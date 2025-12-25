################################################################################
## Base Stage: Start from the official Enterprise image
################################################################################
FROM gristlabs/grist-ee:latest AS base

################################################################################
## Build Stage: Overwrite source and rebuild frontend
################################################################################
FROM base AS builder

USER root

# Copy only the files from your selected branch that contain customizations
# This ensures things like LayoutTray in app/client/components are updated
COPY package.json yarn.lock tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static /grist/static

# Run the build process inside the container. 
# It uses the 'ext' folder already present in the base image.
RUN yarn install --frozen-lockfile && \
    export GRIST_EXT=ext && \
    yarn run build:prod

################################################################################
## Run-time stage: Assemble the final patched image
################################################################################
FROM base

# Copy the newly compiled build artifacts and updated source from the builder
COPY --from=builder /grist/_build /grist/_build
COPY --from=builder /grist/static /grist/static
COPY --from=builder /grist/app /grist/app

# Ensure environment variables required for Enterprise are set
ENV GRIST_PRO=true \
    GRIST_ORG_IN_PATH=true \
    NODE_ENV=production

# The entrypoint and supervisor remain inherited from the grist-ee base image.
WORKDIR /grist
