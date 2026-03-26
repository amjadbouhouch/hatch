# Hatch

Personal AI agent platform — desktop app + gateway server.

## Requirements

- **Node.js** v22+
- **Bun** v1.3+

## Installation

```bash
bun install
```

### Environment

Create a `.env` file at the project root:

```env
OPENROUTER_API_KEY=your-key-here
HATCH_MODEL=openrouter/your-model
HATCH_GATEWAY_TOKEN=your-token
```

## Development

```bash
# Run everything (gateway + desktop)
bun run dev

# Or individually
bun run dev:gateway   # API server on port 3000
bun run dev:desktop   # Electron app with Vite HMR
```
