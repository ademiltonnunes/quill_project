# Quill - AI-Powered Table Tool Calling System

A take-home assessment project that combines AI chat with TanStack Table functionality. Users can interact with a data table through natural language commands, with the AI model (Claude) executing table operations via tool calling.

## 🎯 Project Overview

This project implements a chat interface that allows users to manipulate a data table using natural language. The AI interprets user commands and executes appropriate table operations (filtering, sorting, adding/removing rows) through a tool calling system.

### Key Features

- **AI-Powered Chat Interface**: Natural language interaction with Claude AI
- **TanStack Table Integration**: Full-featured table with filtering, sorting, and pagination
- **Tool Calling System**: AI executes table operations via structured tool calls
- **Streaming Responses**: Real-time streaming of AI responses
- **Cloudflare Workers Backend**: Serverless infrastructure for AI API proxying
- **Multiple Filter Support**: Combine multiple filters for complex queries

## 🏗️ Architecture

### Backend (Cloudflare Worker)

- **Location**: `backend/`
- **Technology**: TypeScript, Cloudflare Workers
- **Main Entry**: `src/index.ts`
- **Key Components**:
  - `handlers/chat.handler.ts`: Handles chat requests with tool calling
  - `services/claude.service.ts`: Claude API integration
  - `services/ai-provider.factory.ts`: Provider factory pattern
  - `utils/stream.ts`: Streaming response handling
  - `utils/validation.ts`: Request validation

### Frontend (React + Vite)

- **Location**: `frontend/`
- **Technology**: React 19, TypeScript, TanStack Table, Vite
- **Main Entry**: `src/main.tsx`
- **Key Components**:
  - `pages/DashboardPage.tsx`: Main dashboard with table and chat
  - `components/DataTable.tsx`: TanStack Table implementation
  - `components/ChatInterface.tsx`: Chat UI component
  - `hooks/useChat.ts`: Chat state management hook
  - `utils/toolExecutor.ts`: Tool execution logic
  - `utils/toolDefinitions.ts`: Tool schema definitions

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (for deploying the worker)
- Claude API key from Anthropic

### Environment Variables

#### Backend (Cloudflare Worker)

Create a `.dev.vars` file in the `backend/` directory:

```bash
CLAUDE_API_KEY=your_claude_api_key_here
```

Or set it via Wrangler:

```bash
wrangler secret put CLAUDE_API_KEY
```

#### Frontend

Create a `.env` file in the `frontend/` directory:

```bash
VITE_API_BASE_URL=http://localhost:8787
```

For production, set this to your deployed Cloudflare Worker URL.

### Installation

1. **Clone the repository** (if applicable)

2. **Install backend dependencies**:
```bash
cd backend
npm install
```

3. **Install frontend dependencies**:
```bash
cd frontend
npm install
```

### Running Locally

1. **Start the Cloudflare Worker** (in `backend/` directory):
```bash
npm run dev
```

The worker will start on `http://localhost:8787` by default.

2. **Start the frontend** (in `frontend/` directory):
```bash
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is taken).

3. **Open your browser** and navigate to the frontend URL.

### Deployment

#### Backend (Cloudflare Worker)

```bash
cd backend
npm run deploy
```

Make sure to set the `CLAUDE_API_KEY` secret in Cloudflare:

```bash
wrangler secret put CLAUDE_API_KEY
```

#### Frontend

```bash
cd frontend
npm run build
```

Deploy the `dist/` folder to your preferred hosting service (Vercel, Netlify, Cloudflare Pages, etc.).

## 📖 Usage

### Table Operations via Chat

Users can interact with the table using natural language commands:

- **Filtering**: 
  - "Show all items with amount greater than 10"
  - "Filter by status active"
  - "Get items where category contains sport"
  
- **Sorting**:
  - "Sort by amount descending"
  - "Sort the table by date"
  
- **Adding Rows**:
  - "Add a new row with name 'Test Item', amount 50, status 'active', date '2024-01-15', category 'Electronics'"
  
- **Removing Rows**:
  - "Delete row with id row-123"
  
- **Clearing**:
  - "Clear all filters"
  - "Remove sorting"

### Supported Filter Operators

- Numeric: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Text: `==`, `!=`, `contains`, `startsWith`, `endsWith`
- All text comparisons are case-insensitive

## 🛠️ Technical Decisions

### Why Claude over OpenAI?

- **Lower Hallucination Rate**: Claude tends to be more accurate with tool calling
- **Better Structured Output**: More reliable JSON parsing for tool arguments
- **Streaming Support**: Native streaming with thinking tags support

### Architecture Choices

1. **Cloudflare Workers**: 
   - Serverless, edge computing
   - Low latency globally
   - Easy deployment and scaling

2. **TanStack Table**:
   - Headless, flexible table library
   - Built-in filtering, sorting, pagination
   - Custom filter functions for complex operations

3. **Tool Calling Pattern**:
   - Structured approach to AI actions
   - Type-safe tool definitions
   - Clear separation between AI reasoning and execution

4. **Streaming**:
   - Real-time user feedback
   - Better UX with progressive rendering
   - Thinking tags for transparency

## 📁 Project Structure

```
Quill/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration constants
│   │   ├── handlers/         # Request handlers
│   │   ├── interfaces/       # Type definitions
│   │   ├── services/         # AI provider services
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Utility functions
│   │   └── index.ts          # Worker entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── wrangler.toml         # Cloudflare Worker config
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── config/           # Frontend constants
│   │   ├── data/             # Sample data
│   │   ├── hooks/            # React hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Utility functions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── README.md
```

## 🧪 Testing

### Manual Testing

1. Test filtering with various operators
2. Test sorting in both directions
3. Test adding rows with all required fields
4. Test deleting rows
5. Test multiple filters combined
6. Test streaming responses
7. Test error handling (invalid commands, missing fields)

## 🐛 Known Issues / Future Improvements

- [ ] Add unit tests for tool execution logic
- [ ] Add integration tests for chat flow
- [ ] Support for more complex filter combinations (OR logic)
- [ ] Undo/redo functionality for table operations
- [ ] Export table data functionality
- [ ] Better error messages for invalid tool calls
- [ ] Support for date range filtering

## 📝 Evaluation Criteria Alignment

1. **Decision Making**: Documented in this README and code comments
2. **Accuracy**: Claude model with detailed system prompts and validation
3. **Streaming**: Full SSE streaming implementation with thinking tags
4. **Table Functionality**: Filtering, sorting, adding/removing rows all supported
5. **Open Source Integration**: TanStack Table, React, Cloudflare Workers
6. **UX**: Smooth streaming, error handling, loading states, responsive design

## 📄 License

This is a take-home assessment project.

## 👤 Author

Built as part of a take-home assessment for Quill.
