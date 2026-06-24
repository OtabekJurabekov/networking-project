# TechAccessories Shop — BTEC Unit 6 Cloud Deployment

A professional static e-commerce website for a small electronics accessories retailer, deployed to a Contabo VPS via Docker and CI/CD.

**Live site:** https://ilmora.net

## Local Development

```bash
docker compose up -d
# Open http://localhost:3006
```

## Project Structure

```
website/        Static HTML/CSS/JS site
Dockerfile      Nginx Alpine container
deploy/         VPS nginx vhost configs
docs/report/    BTEC academic reports
.github/        CI/CD workflows
```

## Deployment

Push to `main` → GitHub Actions → SSH to VPS → docker compose up --build.
