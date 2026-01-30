# Directive: Grist Build System

This SOP defines how we build Grist for development and production, mirroring the logic used on the VPS build script.

## Goal
To produce a consistent build of Grist that includes the `static/custom_index.js` (Master Controller) baked into the final output.

## Remote Build Workflow (Current Strategy)
Instead of building locally, we use a "Code Locally, Build Remotely" approach:
1.  **Develop**: Modify code (primarily `static/custom_index.js`) in the local environment.
2.  **Commit & Push**: Push changes to the `custom-1.7.10-AG` branch on GitHub.
3.  **Trigger VPS**: Run the build script on the VPS, which pulls from GitHub and builds the Docker image.

## Tools (Execution Layer)
- `execution/deploy_trigger.py`: Automates the Git commit/push process to trigger the remote build.
