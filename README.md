# Quill Take Home Project

AI-powered table management system that enables natural language interaction with data tables through tool calling. Users can filter, sort, add, and remove table rows using conversational commands processed by Claude AI.

## Quick Links

- **Live URL**: [https://quill-frontend.pages.dev](https://quill-frontend.pages.dev)
- **Video Demo**: [Watch on Loom](https://www.loom.com/share/35728fd921794e25b093278dbd5474c1)

## Overview

This project consists of two main components:

- **Backend**: Cloudflare Worker that proxies requests to Claude AI API with tool calling support
- **Frontend**: React application with TanStack Table integration and chat interface

For detailed architecture and implementation details, see:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account (for deploying the worker)
- Claude API key from Anthropic

## Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.dev.vars` file (copy from `.dev.vars.example`):
```bash
cp .dev.vars.example .dev.vars
```

4. Add your Claude API key to `.dev.vars`:
```
ANTHROPIC_API_KEY=your_claude_api_key_here
AI_PROVIDER=claude
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
VITE_API_BASE_URL=http://localhost:8787
```

## Running Locally

### Step 1: Start the Backend Worker

In the `backend` directory:
```bash
npm run dev
```

The worker will start on `http://localhost:8787` by default.

### Step 2: Start the Frontend

In the `frontend` directory:
```bash
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is taken).

### Step 3: Open the Application

Navigate to the frontend URL in your browser (typically `http://localhost:5173`).

## Deployment

### Deploy Backend to Cloudflare Workers

1. Navigate to the backend directory:
```bash
cd backend
```

2. Set the Claude API key as a secret in Cloudflare:
```bash
wrangler secret put ANTHROPIC_API_KEY
```
Enter your API key when prompted.

3. Deploy the worker:
```bash
npm run deploy
```

4. Note the deployed worker URL (e.g., `https://quillbackend.your-subdomain.workers.dev`)

### Deploy Frontend to Cloudflare Pages

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Build the production bundle:
```bash
npm run build
```

3. Deploy to Cloudflare Pages:
   - Go to Cloudflare Dashboard > Pages
   - Create a new project
   - Connect your repository or upload the `dist` folder
   - Set the build output directory to `dist`
   - Add environment variable: `VITE_API_BASE_URL` = your deployed worker URL


## Usage

Users interact with the table through natural language commands in the chat interface:

- **Filtering**: "Show all items with amount greater than 10"
- **Sorting**: "Sort by amount descending"
- **Adding rows**: "Add a new row with name 'Test Item', amount 50, status 'active', date '2024-01-15', category 'Electronics'"
- **Removing rows**: "Delete row with name 'Test Item' "
- **Clearing**: "Clear all filters" or "Remove sorting"

## Project Structure

```
Quill/
├── backend/          # Cloudflare Worker backend
│   └── README.md     # Backend documentation
├── frontend/         # React frontend application
│   └── README.md     # Frontend documentation
└── README.md         # This file
```

## Technology Stack

- **Backend**: TypeScript, Cloudflare Workers, Claude AI API
- **Frontend**: React 19, TypeScript, TanStack Table, Vite
