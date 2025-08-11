FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./

# Install dependencies
RUN yarn --immutable

# Copy source code
COPY . .

# Build the frontend
RUN yarn build

# Install a simple static file server
RUN npm install -g serve

# Expose port 3000
EXPOSE 3000

# Serve the built files
CMD ["serve", "-s", "dist", "-l", "3000"]