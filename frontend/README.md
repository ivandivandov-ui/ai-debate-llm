# Debate System Frontend

A modern React frontend for the Synthesis Debate System, built with TypeScript and Tailwind CSS.

## Features

- **Real-time Debate Visualization** — Live updates of multi-agent debates
- **Protocol Selection** — Choose from Socratic, Adversarial, Red Team, and Consensus protocols
- **Agent Monitoring** — Track participating agents and their contributions
- **Debate History** — Browse past debates and results
- **Settings Management** — Configure API keys and system settings
- **Responsive Design** — Works on desktop and mobile devices

## Tech Stack

- **React 18** — Modern React with hooks and concurrent features
- **TypeScript** — Type-safe development
- **Tailwind CSS** — Utility-first CSS framework
- **React Router** — Client-side routing
- **React Query** — Data fetching and caching
- **Axios** — HTTP client
- **Vite** — Fast build tool and dev server

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── types.ts       # TypeScript type definitions
├── utils/         # Utility functions and API client
├── App.tsx        # Main app component
├── main.tsx       # App entry point
└── index.css      # Global styles
```

## API Integration

The frontend connects to the backend REST API at `/api`. Make sure the backend server is running on the configured port (default: 3000).

## Development

- **Linting:** `npm run lint`
- **Type checking:** Built into the build process
- **Hot reload:** Automatic during development

## Deployment

Build the project for production:

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.