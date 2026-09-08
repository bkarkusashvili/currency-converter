DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: up down dev logs

up:
	docker compose up --build -d --wait

down:
	docker compose down

dev:
	$(DEV) up -d

logs:
	docker compose logs -f
