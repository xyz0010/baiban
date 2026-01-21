FROM --platform=${BUILDPLATFORM} node:20 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production

# Vite build arguments
ARG VITE_APP_BACKEND_V2_GET_URL
ARG VITE_APP_BACKEND_V2_POST_URL
ARG VITE_APP_LIBRARY_URL
ARG VITE_APP_LIBRARY_BACKEND
ARG VITE_APP_PLUS_LP
ARG VITE_APP_PLUS_APP
ARG VITE_APP_AI_BACKEND
ARG VITE_APP_WS_SERVER_URL
ARG VITE_APP_FIREBASE_CONFIG
ARG VITE_APP_ENABLE_TRACKING
ARG VITE_APP_PLUS_EXPORT_PUBLIC_KEY

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM --platform=${TARGETPLATFORM} node:20-alpine

WORKDIR /opt/node_app

COPY --from=build /opt/node_app/excalidraw-app/build ./public
COPY server.js ./server.js

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
