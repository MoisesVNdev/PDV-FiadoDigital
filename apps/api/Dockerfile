FROM node:20.19-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY prisma ./prisma
COPY apps/api ./apps/api

# Recria links de workspace (apps/api/node_modules) após copiar o código.
RUN pnpm install --frozen-lockfile

RUN cp /app/prisma/schema.prisma /app/apps/api/prisma/schema.prisma
RUN pnpm --filter @pdv/api exec prisma generate --schema ./prisma/schema.prisma

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["pnpm", "--filter", "@pdv/api", "run", "dev"]
