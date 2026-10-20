# Sphere Form

A modern, secure, and responsive web application featuring user authentication and an email-verified contact form.

## Overview

Sphere Form is a full-stack web application designed to provide a smooth user experience through account registration, login, and email verification. It combines a React-based frontend with a Node.js backend and MongoDB database.

## Features

- **User Authentication** — User registration and login.
- **Secure Password Handling** — Password hashing with bcrypt.
- **JWT Authentication** — Token-based authentication for protected routes.
- **Email Verification** — OTP-based email verification workflow.
- **Contact Form** — Submit contact messages through the application.
- **MongoDB Integration** — Store user and verification data.
- **Rate Limiting** — Help reduce repeated requests and OTP abuse.
- **Responsive Interface** — Designed for a range of screen sizes.
- **Animated 3D Background** — Interactive visual effects using Three.js and React Three Fiber.

## Technology Stack

**Frontend**
- React
- Vite
- Tailwind CSS
- Three.js
- React Three Fiber

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token (JWT)
- bcryptjs
- Nodemailer

Screenshots

Screenshots of the application can be added here to demonstrate the interface and main features.

Main Interface

Replace the placeholder below with a screenshot of your website.

![Sphere Form Main Interface](screenshots/main-interface.png)

Login and Registration

![Login and Registration Interface](screenshots/auth-interface.png)

Contact Form and OTP Verification

![Contact Form and OTP Verification](screenshots/contact-otp.png)

## Project Structure

```text
sphere-form/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env
├── src/
├── public/
├── package.json
├── .gitignore
└── README.md
```

*Note: The structure above is illustrative. Your actual folders and files may differ.*

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- A MongoDB database
- A Gmail account configured for SMTP with an App Password, if using Gmail for email delivery

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd sphere-form
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Configure Environment Variables

Create a `.env` file inside the `backend/` directory and configure the variables required by your backend:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_random_secret
EMAIL_USER=your_email_address
EMAIL_APP_PASSWORD=your_gmail_app_password
RECEIVER_EMAIL=your_receiver_email
CLIENT_ORIGIN=http://localhost:5173
```

Replace the example values with your own credentials. Never commit real passwords, tokens, or database connection strings to GitHub.

### 5. Run the Backend

From the `backend/` directory:

```bash
npm start
```

The backend should start at:

`http://localhost:5000`

### 6. Run the Frontend

Open a second terminal in the project root:

```bash
npm run dev
```

Vite will display the local frontend URL in the terminal, typically:

`http://localhost:5173`

## Deployment

The application can be deployed using services such as:

- **Frontend:** Vercel or Netlify
- **Backend:** Render
- **Database:** MongoDB Atlas

Before deployment, configure the required environment variables in the hosting provider and update the frontend API URL and backend CORS origin to match the deployed URLs.

## Security Notes

- Never upload `.env` files or private credentials.
- Use a strong, private JWT secret.
- Keep email App Passwords private.
- Validate and protect authentication and email-verification endpoints.
- Configure production CORS origins explicitly.

## Project Status

Development and deployment preparation are in progress.

## License

No license has been specified yet. All rights are reserved by default unless a license is added to the repository.