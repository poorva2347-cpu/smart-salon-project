# Smart Salon

Smart Salon is a salon appointment booking web application designed to simplify the process of discovering barbers, exploring services, and managing salon appointments.

## Features

- Customer authentication
- Barber profiles and listings
- Salon appointment booking
- Appointment management
- Admin and barber interfaces
- Responsive frontend interface
- AI-powered conversational assistant

## Technology Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- REST APIs

### Database
- SQL database (see `backend/schema.sql` for the schema)

## Project Structure

```text
SMART SALON OFFICIAL/
├── admin/
├── auth/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── schema.sql
│   ├── package.json
│   └── server.js
├── Barber/
├── barber_images/
├── js/
├── logo/
├── service_images/
├── The_Smart_Salon/
├── index.html
├── auth.css
├── style.css
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- A configured database compatible with the project
- Git

### Installation

1. Clone this repository.
2. Navigate to the backend directory.
3. Install the backend dependencies.
4. Configure your environment variables in `backend/.env`.
5. Create and configure the database using the provided schema, adapting the steps to your database setup.
6. Start the backend using the script defined in `backend/package.json`.
7. Open the frontend using your configured local server.

### Environment Variables

Create a local `backend/.env` file and configure the variables required by the application.

Never commit API keys, database passwords, tokens, or other secrets.

## Security

- Keep credentials in environment variables.
- Never commit `.env` files.
- Do not upload private user data or production database records.

## Project Status

Developed as a full-stack salon appointment booking project.

## License

No license has been specified yet.
