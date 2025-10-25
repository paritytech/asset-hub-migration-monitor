FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./
COPY .papi ./.papi

RUN yarn --immutable

COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src

# Create data directory for database
RUN mkdir -p data

# Build the application
RUN yarn build

ENV NODE_ENV=production

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"] 