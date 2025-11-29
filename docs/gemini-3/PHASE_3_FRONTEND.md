# Phase 3: Frontend Polish

## Objective
Elevate the user experience by adopting a professional component library and implementing real-time streaming for interactions.

## 1. UI Component Library (shadcn/ui)
**Current State**: Custom components (`Modal.tsx`, `Toast.tsx`) mixed with Tailwind.
**Target State**: **shadcn/ui** (Radix UI + Tailwind).

### Implementation Steps
1.  **Initialize**: Run `npx shadcn-ui@latest init` in `apps/web`.
2.  **Install Components**: Add core components: `button`, `input`, `dialog` (modal), `toast`, `card`, `dropdown-menu`, `avatar`, `separator`.
3.  **Refactor**: Systematically replace custom components with shadcn equivalents.
    - Replace `Modal.tsx` with `Dialog`.
    - Replace `Toast.tsx` with `Sonner` or `Toaster`.
    - Replace `ApproachCard.tsx` and others with `Card`.
4.  **Theming**: Configure `globals.css` with CSS variables for a consistent, easily themeable color palette (Dark/Light mode support is built-in).

## 2. Streaming Chat Interface
**Current State**: Request/Response (wait for full answer).
**Target State**: Real-time token streaming.

### Implementation Steps
1.  **Backend**: Update `agent.ts` to use `streamText` from Vercel AI SDK and return a `DataStreamResponse`.
2.  **Frontend Hook**: Use `useChat` from `ai/react` in `apps/web`.
    - This hook handles message state, loading, and streaming updates automatically.
3.  **UI Update**: Update `ChatHistorySidebar` and the main chat area to render messages as they stream in.
4.  **Tool Feedback**: Ensure tool calls and results are visualized in the stream (e.g., "Searching knowledge base..." -> "Found 3 results").

## Success Criteria
- [ ] The application uses shadcn/ui components for all core interactions.
- [ ] Chat responses stream character-by-character.
- [ ] The UI looks professional, consistent, and responsive on mobile.
