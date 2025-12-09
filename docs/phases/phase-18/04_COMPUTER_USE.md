# Phase 18.4: Computer Use Pack (Beta)

## Overview
This phase implements the cutting-edge **"Computer Use"** capability introduced in Claude 3.5 Sonnet (Beta 2024-10-22). This allows the agent to visually interact with screens, making it capable of E2E testing, browser verification, and using GUI-only applications.

**Status:** BETA. Implementation requires specific infrastructure.

---

## 1. Infrastructure: The Virtual Display

To allow Claude to "see", we must run a display server. We cannot give it access to the host's physical GPU/Monitor for privacy and technical reasons.

### Docker Configuration
We need a special Docker image (`anthropic/claude-computer-use-demo` or custom build) running:
1.  **Xvfb:** X Virtual Framebuffer (simulates a screen in RAM).
2.  **Window Manager:** Fluxbox or similar lightweight WM.
3.  **VNC Server:** For *humans* to watch what the agent is doing (debug).
4.  **Applications:** Chromium, VS Code, Terminal.
5.  **Agency Service:** An HTTP service inside the container that executes the low-level mouse/keyboard commands.

> **Note:** We will likely build a custom image `synthesis-computer-use` based on Anthropic's demo to include our specific dependencies. A build script will be provided in `apps/server/src/services/computer-use/Dockerfile`.

### Service Setup
Add to `docker-compose.yml`:
```yaml
  computer-use:
    image: synthesis-computer-use:latest # Custom build
    build:
      context: ./apps/server/src/services/computer-use
    ports:
      - "5900:5900" # VNC
      - "8080:8080" # noVNC (web view)
    environment:
      - WIDTH=1024
      - HEIGHT=768
```

---

## 2. Computer Use Tools

The [Claude Agent SDK](https://github.com/anthropic-ai/claude-agent-sdk-ts) provides primitives, but we must expose them via MCP or the SDK's beta tool interface.

### Tools to Implement
1.  **`computer_screenshot`**: Returns a base64 encoded image of the Xvfb buffer.
2.  **`computer_cursor`**: `move(x, y)`, `click(button)`.
3.  **`computer_keyboard`**: `type(text)`, `keypress(key)`.

### Tool Definition
These tools are defined by Anthropic's beta API specs. The Model Context Protocol implementation must forward these requests to the container (likely via an HTTP agency service running inside the container).

---

## 3. Use Cases

### A. Visual Regression Testing
**User:** "Go to localhost:3000/dashboard and verify the chart renders correctly."
**Agent:** 
1.  Opens Chromium.
2.  Types URL.
3.  Takes screenshot.
4.  Analyzes pixels to confirm chart is visible.

### B. "Click-Ops" Automation
**User:** "Log into the old AWS console and click the restart button on instance i-1234."
**Agent:** Navigates the GUI to perform actions available only via mouse.

---

## Toolpack Configuration

Update `apps/server/src/agent/tool-definitions/toolpacks.ts`:

```typescript
export const COMPUTER_TOOLPACK: ToolpackDefinition = {
  name: 'computer_use',
  description: 'Visual interaction with a virtual computer (Beta).',
  defaultCategory: 'experimental',
  tools: ['computer_screenshot', 'computer_cursor', 'computer_keyboard'],
  sensitiveTools: ['computer_cursor', 'computer_keyboard'], 
};
```

## Warnings
- **Latency:** Screenshot loop is slow (seconds per action).
- **Cost:** High token usage (images are token-heavy).
- **Stability:** Beta feature, API may change.
