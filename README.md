# AudioTrack API - Subscription and Payments Platform

A production-ready backend API for an audio marketplace, built with AdonisJS 6, MySQL, Redis queueing, and Stripe billing.

AdonisJS 6 | TypeScript | MySQL | Redis | Stripe | BullMQ

## Overview

AudioTrack API powers a multi-role platform for:

- Authentication and email verification
- Seller track management (create, update, publish workflow)
- Admin moderation for tracks, genres, and moods
- Favorites and reviews for end users
- Subscription plans and recurring billing with Stripe
- Payment intents, checkout sessions, refunds, and webhook handling
- Background email jobs via Bull queue and Redis

## Key Highlights

- Secure auth flow with role-based access control (admin, seller, user)
- Stripe integration for subscriptions, checkout, and webhook event processing
- Redis-backed async jobs for mail and background tasks
- Rate-limited public and auth endpoints
- Structured AdonisJS architecture with controllers, services, middleware, and Lucid models
- CSV export support for admin track reports

## Tech Stack

| Layer | Technology |
|------|------|
| Runtime | Node.js |
| Framework | AdonisJS 6 |
| Language | TypeScript |
| Database | MySQL (Lucid ORM) |
| Queue | BullMQ with @rlanz/bull-queue |
| Cache / Queue Broker | Redis |
| Payments | Stripe API + custom adonis-stripe-package |
| Mail | @adonisjs/mail |
| Validation | VineJS |
| Lint / Format | ESLint, Prettier |
| Testing | Japa |

## Features

### Authentication and Account

- Register, login, logout, profile endpoint
- Email verification flow
- Forgot password and reset password flow
- Resend verification email

### Tracks and Marketplace

- Seller CRUD for tracks
- Public listing by genre and mood
- Favorites toggle and listing
- Reviews create, update, delete, and list

### Admin

- Track moderation (pending, approve, reject)
- Genre and mood management
- Track export endpoint

### Payments and Subscriptions

- Payment intent creation
- Stripe checkout session creation
- Payment status and refund endpoints
- Subscription create, cancel, upgrade, customer sync
- Billing portal redirect
- Stripe webhook endpoint with signature verification

### Queue and Background Processing

- Redis-backed queue connection
- Mail jobs processed asynchronously
- Retry and exponential backoff defaults

## Project Structure

audio-track-project/
|-- app/
|   |-- controllers/
|   |-- jobs/
|   |-- middleware/
|   |-- models/
|   |-- services/
|-- config/
|-- database/
|   |-- migrations/
|   |-- seeders/
|-- start/
|   |-- env.ts
|   |-- kernel.ts
|   |-- routes.ts
|-- tests/
|-- package.json

## Getting Started

## Prerequisites

- Node.js 18+
- MySQL running locally
- Redis running locally
- Stripe account and Stripe CLI (recommended for webhooks)

## Setup On A New Machine (Clone + Run)

Follow these steps when you are setting up this project on a brand new laptop or system.

1) Clone the repository

git clone <your-repo-url>
cd audio-track-project

2) Install Node dependencies

npm install

3) Prepare environment file

- Copy .env.example to .env
- Fill all required values from the Environment Variables section below
- Make sure Stripe keys and PRICE_* IDs are valid for your Stripe account

Windows CMD:

copy .env.example .env

PowerShell:

Copy-Item .env.example .env

4) Ensure MySQL is running and create database

- Start MySQL service locally
- Create the database name used in .env (example: audio_track)

5) Run database migrations

node ace migration:run

6) Start Redis

If Redis is installed as a Windows service:

net start Redis

If not service-based:

redis-server

7) Start application processes in separate terminals

Terminal 1 (API server):

npm run dev

Terminal 2 (queue worker):

node ace queue:listen

Terminal 3 (Stripe webhook forwarder, recommended):

stripe listen --forward-to http://localhost:3333/webhook

8) Verify services

- API server should be running on http://localhost:3333
- Redis check: redis-cli ping (expect PONG)
- Queue worker terminal should stay active without connection errors
- Stripe CLI should print webhook events when triggered

## Install (Existing Local Copy)

1) Open terminal in this folder:

C:\Users\Fenil\OneDrive\Desktop\Appstone\adonis\audio-track\audio_track+Stripe_package\audio-track-project

2) Install dependencies:

npm install

3) Configure environment:

- Copy .env.example to .env (or update existing .env)
- Fill DB, SMTP, Redis, and Stripe values

4) Run migrations:

node ace migration:run

## Environment Variables

Required keys (from start/env.ts):

NODE_ENV=development
PORT=3333
HOST=localhost
APP_KEY=
APP_URL=http://localhost:3333
LOG_LEVEL=info

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_DATABASE=audio_track

SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=

LIMITER_STORE=memory

QUEUE_REDIS_HOST=127.0.0.1
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_PASSWORD=

SESSION_DRIVER=cookie

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_API_VERSION=

PRICE_PERSONAL=
PRICE_PROFESSIONAL=
PRICE_STARTUP=
PRICE_BUSINESS=
PRICE_LIFETIME=

## Run the Project (Multi-Terminal Setup)

Use separate terminals for each long-running process.

### Terminal 1 - API Server

cd C:\Users\Fenil\OneDrive\Desktop\Appstone\adonis\audio-track\audio_track+Stripe_package\audio-track-project
npm run dev

### Terminal 2 - Queue Worker

cd C:\Users\Fenil\OneDrive\Desktop\Appstone\adonis\audio-track\audio_track+Stripe_package\audio-track-project
node ace queue:listen

### Terminal 3 - Stripe Webhook Forwarding (optional but recommended)

cd C:\Users\Fenil\OneDrive\Desktop\Appstone\adonis\audio-track\audio_track+Stripe_package\audio-track-project
stripe listen --forward-to http://localhost:3333/webhook

### Redis (Local service)

If Redis is installed as Windows service:

net start Redis

If not service-based, run manually:

redis-server

## Available Scripts

| Script | Description |
|------|------|
| npm run dev | Start Adonis dev server with HMR |
| npm run build | Build for production |
| npm start | Run production server |
| npm run test | Run test suite |
| npm run lint | Lint project |
| npm run format | Format codebase |
| npm run typecheck | Type-check TypeScript |

## Stripe Notes

- Keep webhook secret synchronized with Stripe CLI output in local development
- Plan price IDs in .env must match Stripe dashboard products
- Webhook route is POST /webhook

## Security Notes

- Do not commit real secrets in .env
- Rotate Stripe keys and SMTP credentials if they were ever exposed
- Use production-safe APP_KEY and strict CORS in deployment

## Author

Fenil Patel
