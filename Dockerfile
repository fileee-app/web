FROM node:24-slim AS base

# pnpm is pinned by packageManager in package.json. Cached outside root's home so the node user can run it.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable

WORKDIR /app


FROM base AS build

COPY . .

# Reinstalls from scratch because --prod alone leaves devDependencies in node_modules/.pnpm.
# COPY keeps the host's modes, and a 600 file here would be unreadable to the node user.
RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && find . -name node_modules -type d -prune -exec rm -rf {} + \
  && pnpm install --frozen-lockfile --prod --offline \
  && chmod -R a+rX /app /opt/corepack


FROM base

# pnpm stays in the image for `pnpm admin:reset-password`.
COPY --from=build /opt/corepack /opt/corepack
COPY --from=build /app /app

ENV NODE_ENV=production

EXPOSE 3000

USER node

# A 3xx is healthy: / redirects to setup or login.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD ["node", "-e", "fetch('http://localhost:3000/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"]

# Not `pnpm start`: pnpm doesn't pass SIGTERM on, so docker stop would wait 10s and then kill the app.
CMD ["node", "apps/web/start.ts"]
