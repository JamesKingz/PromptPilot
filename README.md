# PromptPilot

Currently,

The project provides a responsive login and account-registration experience, with secure session handling and email-based one-time password (OTP) verification, it includes a React frontend and an Express API backed by PostgreSQL. Users can create an account, verify their email, sign in with an OTP, reset a forgotten password, and maintain a refresh session.

## Features

- Responsive login and registration pages
- Email and password validation
- Registration and login OTP verification
- Forgot-password flow
- Password hashing with bcrypt
- JWT access tokens and HTTP-only refresh cookies
- CSRF and origin protection
- Login and OTP rate limiting
- PostgreSQL storage through Drizzle ORM
- OTP delivery through a local mailbox log, SMTP, or Resend

## Tech Stack

- Frontend: React 19, TypeScript, Vite
- Backend: Node.js, Express 5, TypeScript
- Database: PostgreSQL, Drizzle ORM
- Authentication: JWT, bcrypt, HTTP-only cookies
- Email/OTP: Nodemailer, Resend, or file-based development delivery

## Project Structure

```text
src/                   React frontend
src/assets/components/ Login and registration components
auth_server/src/       Express authentication server
auth_server/src/routes Authentication API routes
auth_server/src/services
                       Authentication, OTP, and token services
auth_server/src/db/    Database schema and migration setup
auth_server/drizzle/   Generated SQL migrations
```

## Prerequisites

Install the following before starting:

- Node.js 20 or newer
- npm
- PostgreSQL

## Installation

1. Clone the repository and enter the project directory:

```bash
git clone https://github.com/JamesKingz/Ai.git
cd Ai
```

2. Install the dependencies:

```bash
npm install
```

3. Create a PostgreSQL database:

```sql
CREATE DATABASE PromptPilot;
```

4. Create the server environment file:

```bash
cp auth_server/.env.example auth_server/.env
```

Update `DATABASE_URL` in `auth_server/.env` with your PostgreSQL username, password, and database name. For example:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/PromptPilot
```

For a local development setup, replace the example JWT and OTP secrets with strong random values:

```env
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_REFRESH_SECRET=replace-with-a-different-at-least-32-random-characters
OTP_HMAC_SECRET=replace-with-a-third-at-least-32-random-secret
CSRF_SECRET=replace-with-a-fourth-at-least-32-random-secret
```

All four values should be different.

## OTP Email Configuration

The default development provider is `file`. It writes OTP messages to:

```text
auth_server/.otp-mailbox.log
```

The current OTP code is also printed in the server terminal.

For SMTP delivery, set:

```env
OTP_EMAIL_PROVIDER=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_FROM_EMAIL=no-reply@localhost
SMTP_FROM_NAME=PromptPilot
```

For Resend delivery, set:

```env
OTP_EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=no-reply@example.com
RESEND_FROM_NAME=PromptPilot
```

Do not use the file provider in production.

## Database Setup

Apply the existing migrations:

```bash
npm run db:migrate
```

Drizzle can also generate migrations or open the database browser:

```bash
npm run db:generate
npm run db:push
npm run db:studio
```

Use `db:push` carefully outside local development because it can alter the database schema.

## Running the Project

Start the backend in one terminal:

```bash
npm run dev:server
```

The API will run at `http://localhost:5001`.

Start the frontend in a second terminal:

```bash
npm run dev
```

Open `http://localhost:5173`.

The Vite development server proxies `/api` requests to the Express server.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the React frontend |
| `npm run dev:server` | Start the backend with file watching |
| `npm run build` | Build the frontend |
| `npm run build:server` | Compile the backend |
| `npm run start:server` | Run the compiled backend |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production frontend build |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:generate` | Generate migrations from the schema |
| `npm run db:push` | Push schema changes directly to PostgreSQL |
| `npm run db:studio` | Open Drizzle Studio |

## API Endpoints

The authentication server exposes the following main endpoints:

- `GET /api/health` - Check server status
- `GET /api/auth/csrf` - Create a CSRF security session
- `POST /api/auth/register` - Start account registration
- `POST /api/auth/verify-registration` - Verify a registration OTP
- `POST /api/auth/login` - Start login verification
- `POST /api/auth/verify-login` - Verify a login OTP
- `POST /api/auth/resend-otp` - Resend an OTP
- `POST /api/auth/forgot-password` - Request a password reset
- `POST /api/auth/reset-password` - Complete a password reset
- `GET /api/auth/me` - Get the authenticated user
- `POST /api/auth/refresh` - Refresh an access token
- `POST /api/auth/logout` - Revoke the refresh session

## Production Notes

- Set `NODE_ENV=production`.
- Configure a production PostgreSQL database.
- Use long, unique values for every secret.
- Set `COOKIE_SECURE=true` when serving over HTTPS.
- Configure `FRONTEND_URL`, `ALLOWED_ORIGINS`, SMTP, or Resend.
- Do not use the file OTP provider in production.
- Build and serve the frontend and backend using your preferred deployment platform.
