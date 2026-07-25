# Docker Hub OCI index digest verified 2026-07-25 with
# `docker buildx imagetools inspect --raw` plus an independent SHA-256 readback.
FROM python:3.14-alpine@sha256:26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92 AS openapi-generate

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src \
    UOK_BOOTSTRAP_ON_IMPORT=0 \
    DATABASE_URL=sqlite:///./data/openapi-container.db \
    DATA_DIR=/app/data

WORKDIR /app
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt
COPY migrations ./migrations
COPY modules ./modules
COPY scripts ./scripts
COPY src ./src
RUN python scripts/validate_container_module_assets.py --require-tests-excluded
COPY web/package.json web/package-lock.json web/tsconfig.json ./web/
COPY web/src ./web/src
RUN python scripts/export_openapi_schema.py
RUN python scripts/generate_frontend_module_catalog.py --check

# Docker Hub OCI index digest verified 2026-07-25 with the same registry readback.
FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS web-build

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
COPY web/scripts/patch-redocly-js-yaml.cjs ./scripts/patch-redocly-js-yaml.cjs
RUN npm ci
COPY web ./
COPY modules /app/modules
COPY --from=openapi-generate /app/web/src/generated ./src/generated
RUN npm run generate:client && npm run build:client -- --outDir /app/web-dist

FROM python:3.14-alpine@sha256:26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92

ARG UOK_VERSION=development
ARG UOK_REVISION=unknown
ARG UOK_SOURCE_URL=https://github.com/Soyuz-Tec/UOK

LABEL org.opencontainers.image.title="UOK" \
      org.opencontainers.image.description="Unified Operating Kernel modular monolith" \
      org.opencontainers.image.version="${UOK_VERSION}" \
      org.opencontainers.image.revision="${UOK_REVISION}" \
      org.opencontainers.image.source="${UOK_SOURCE_URL}"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src \
    DATA_DIR=/data \
    UOK_AUTO_CREATE_SCHEMA=0 \
    UOK_SEED_LOCAL_DATA=0 \
    UOK_SELF_REGISTRATION=0

WORKDIR /app
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt
COPY docs ./docs
COPY migrations ./migrations
COPY modules ./modules
COPY scripts ./scripts
COPY web/package.json web/package-lock.json web/tsconfig.json ./web/
COPY web/src ./web/src
COPY src ./src
COPY --from=web-build /app/web-dist ./src/uok/static/app

RUN python scripts/validate_container_module_assets.py --require-tests-excluded

RUN addgroup -S -g 10001 uok \
    && adduser -S -D -H -u 10001 -G uok uok \
    && mkdir -p /data \
    && chown -R uok:uok /data /app
USER uok

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=3).read()"]
CMD ["python", "-m", "uvicorn", "uok.host.application:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
