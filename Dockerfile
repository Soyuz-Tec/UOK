FROM python:3.14-slim AS openapi-generate

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

FROM node:26-alpine AS web-build

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
COPY --from=openapi-generate /app/web/src/generated ./src/generated
RUN npm run generate:client && npm run build:client -- --outDir /app/web-dist

FROM python:3.14-slim

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

RUN useradd -r -u 10001 uok && mkdir -p /data && chown -R uok:uok /data /app
USER uok

EXPOSE 8080
CMD ["python", "-m", "uvicorn", "uok.main:app", "--host", "0.0.0.0", "--port", "8080"]
