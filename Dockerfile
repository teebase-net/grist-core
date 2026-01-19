# ============================================================================== 
# STAGE 0: Official Enterprise Source 
# ============================================================================== 
FROM gristlabs/grist:latest AS enterprise-source

# ============================================================================== 
# STAGE 1: Install Dependencies 
# ============================================================================== 
FROM node:22-trixie AS dependencies-builder

WORKDIR /grist
COPY package.json yarn.lock /grist/
RUN yarn install --frozen-lockfile --network-timeout 600000

# ============================================================================== 
# STAGE 2: Builder (Your Fork) 
# ============================================================================== 
FROM dependencies-builder AS app-builder

# Copy TypeScript configuration files and source files
COPY tsconfig.json tsconfig-ext.json tsconfig-prod.json /grist/
COPY app /grist/app
COPY stubs /grist/stubs
COPY buildtools /grist/buildtools
COPY static/locales /grist/static/locales

# Build the production JS/CSS bundles
RUN WEBPACK_EXTRA_MODULE_PATHS=/node_modules yarn run build:prod

# ============================================================================== 
# STAGE 3: Final Run-time (Full Enterprise Hybrid) 
# ============================================================================== 
FROM gristlabs/grist:latest AS final-image

# Copy enterprise-generated files first 
COPY --from=enterprise-source /grist/_build/ext /grist/_build/ext

# Copy built application files from app-builder stage 
COPY --from=app-builder /grist/_build /grist/_build
COPY --from=app-builder /grist/static /grist/static

# Ownership fix for the Grist user
RUN chown -R 1001:1001 /grist/_build /grist/static

# Switch to a non-root user for security 
USER 1001
ENV NODE_ENV=production
ENV GRIST_ORG_IN_PATH=true

# Expose the service port
EXPOSE 8484

# Set entry point and command for the container
ENTRYPOINT ["./sandbox/docker_entrypoint.sh"]
CMD ["node", "./sandbox/supervisor.mjs"]
