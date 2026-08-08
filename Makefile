SHELL := /bin/bash

DB_CONTAINER := field-report-mysql
DB_IMAGE := mysql:8.0
DB_NAME := field_report
DB_USER := app
DB_PASSWORD := app123
DB_ROOT_PASSWORD := root123
DB_PORT := 3306

.PHONY: help db-up db-down db-start db-stop db-restart db-logs db-shell db-status \
	backend-dev backend-build backend-start prisma-generate prisma-migrate prisma-deploy prisma-studio seed

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
