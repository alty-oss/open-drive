FROM golang:1.27.3-alpine AS backend-builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/open-drive ./cmd/open-drive

FROM node:22-alpine AS frontend-builder

WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY shared/ ./shared/
COPY client/ ./client/
RUN npm run build --prefix client

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates ffmpeg
COPY --from=backend-builder /out/open-drive /usr/local/bin/open-drive
COPY --from=frontend-builder /app/client/dist ./client/dist
RUN mkdir -p /app/storage

EXPOSE 3050

CMD ["/usr/local/bin/open-drive"]
