FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=deps /app/node_modules/sharp ./node_modules/sharp
COPY --from=deps /app/node_modules/@img ./node_modules/@img

RUN mkdir -p /data/originals /data/thumbs

EXPOSE 25053
ENV PORT=25053
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
