SHELL := /bin/bash

DB_CONTAINER := field-report-mysql
DB_IMAGE := mysql:8.0
DB_NAME := field_report
DB_USER := app
DB_PASSWORD := app123
DB_ROOT_PASSWORD := root123
DB_PORT := 3306

# Docker Hub: https://hub.docker.com/repository/docker/nartkosova/podravka-backend
IMAGE := nartkosova/podravka-backend
# Override on the command line: make docker-release TAG=v1.2.0
TAG ?= latest
# Immutable tag so every push is traceable back to a commit. "-dirty" is
# appended when the working tree has uncommitted changes.
GIT_TAG := $(shell git rev-parse --short HEAD 2>/dev/null || echo nogit)$(shell git diff --quiet 2>/dev/null || echo -dirty)
# Deployment hosts are amd64; without this an arm64 machine silently pushes an
# image the server cannot run.
PLATFORM ?= linux/amd64
# Host port used by "make docker-run"
APP_PORT ?= 3000

.PHONY: help db-up db-down db-start db-stop db-restart db-logs db-shell db-status \
	backend-dev backend-build backend-start prisma-generate prisma-migrate prisma-deploy prisma-studio seed \
	docker-login docker-build docker-push docker-release docker-run docker-tags

help:
	@echo "Available commands:"
	@echo "  make db-up            Start MySQL container, creating it if needed"
	@echo "  make db-down          Stop and remove MySQL container"
	@echo "  make db-start         Start existing MySQL container"
	@echo "  make db-stop          Stop MySQL container"
	@echo "  make db-restart       Restart MySQL container"
	@echo "  make db-logs          Tail MySQL logs"
	@echo "  make db-shell         Open MySQL shell"
	@echo "  make db-status        Show MySQL container status"
	@echo "  make backend-dev      Run backend in dev mode"
	@echo "  make backend-build    Build backend"
	@echo "  make backend-start    Run built backend"
	@echo "  make prisma-generate  Generate Prisma client"
	@echo "  make prisma-migrate   Create and apply a Prisma migration"
	@echo "  make prisma-deploy    Apply Prisma migrations"
	@echo "  make prisma-studio    Open Prisma Studio"
	@echo "  make seed             Seed local example data"
	@echo ""
	@echo "Docker Hub ($(IMAGE)):"
	@echo "  make docker-login     Log in to Docker Hub"
	@echo "  make docker-build     Build the image (tags :$(TAG) and :$(GIT_TAG))"
	@echo "  make docker-push      Push both tags"
	@echo "  make docker-release   Build then push  <- the usual one"
	@echo "  make docker-run       Run the built image locally on port $(APP_PORT)"
	@echo "  make docker-tags      Show the tags that would be produced"

db-up:
	@if docker ps -a --format '{{.Names}}' | grep -Fxq "$(DB_CONTAINER)"; then \
		echo "Starting existing MySQL container $(DB_CONTAINER)..."; \
		docker start $(DB_CONTAINER); \
	else \
		echo "Creating MySQL container $(DB_CONTAINER)..."; \
		docker run -d \
			--name $(DB_CONTAINER) \
			-e MYSQL_ROOT_PASSWORD=$(DB_ROOT_PASSWORD) \
			-e MYSQL_DATABASE=$(DB_NAME) \
			-e MYSQL_USER=$(DB_USER) \
			-e MYSQL_PASSWORD=$(DB_PASSWORD) \
			-p $(DB_PORT):3306 \
			$(DB_IMAGE); \
	fi

db-down:
	@docker rm -f $(DB_CONTAINER) || true

db-start:
	@docker start $(DB_CONTAINER)

db-stop:
	@docker stop $(DB_CONTAINER)

db-restart:
	@docker restart $(DB_CONTAINER)

db-logs:
	@docker logs -f $(DB_CONTAINER)

db-shell:
	@docker exec -it $(DB_CONTAINER) mysql -u$(DB_USER) -p$(DB_PASSWORD) $(DB_NAME)

db-status:
	@docker ps -a --filter name=$(DB_CONTAINER) --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

backend-dev:
	npm run dev

backend-build:
	npm run build

backend-start:
	npm run start

prisma-generate:
	npx prisma generate

prisma-migrate:
	@read -p "Migration name: " name; \
	npx prisma migrate dev --name $$name

prisma-deploy:
	npx prisma migrate deploy

prisma-studio:
	npx prisma studio

seed:
	npm run seed

# --- Docker Hub -------------------------------------------------------------

docker-tags:
	@echo "image:    $(IMAGE)"
	@echo "tags:     $(TAG), $(GIT_TAG)"
	@echo "platform: $(PLATFORM)"

docker-login:
	@docker login

docker-build:
	@echo "Building $(IMAGE):$(TAG) and $(IMAGE):$(GIT_TAG) for $(PLATFORM)..."
	@docker build \
		--platform $(PLATFORM) \
		-f dockerfile \
		-t $(IMAGE):$(TAG) \
		-t $(IMAGE):$(GIT_TAG) \
		.

docker-push:
	@if ! docker image inspect $(IMAGE):$(TAG) >/dev/null 2>&1; then \
		echo "Image $(IMAGE):$(TAG) not found locally. Run 'make docker-build' first."; \
		exit 1; \
	fi
	@docker push $(IMAGE):$(TAG)
	@docker push $(IMAGE):$(GIT_TAG)
	@echo "Pushed $(IMAGE):$(TAG) and $(IMAGE):$(GIT_TAG)"

docker-release: docker-build docker-push

# Smoke-test the image before pushing. Reads config from .env; the app listens
# on 3000 inside the container.
docker-run:
	@docker run --rm -it \
		--env-file .env \
		-p $(APP_PORT):3000 \
		$(IMAGE):$(TAG)
