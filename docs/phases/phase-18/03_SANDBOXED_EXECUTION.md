# Phase 18.3: Sandboxed Execution Pack

## Overview
This phase implements **Safe Code Execution**. Instead of allowing the agent to run commands on the host machine (high risk), we create a disposable, isolated Docker environment. This allows the agent to run `npm test`, `git`, or Python scripts safely.

**Risk Profile:** High (Code Execution) - Mitigated by Docker Isolation.

---

## 1. The Sandbox Service

### Architecture
We will run a persistent Docker container named `synthesis-sandbox`.
- **Image:** `node:22-slim` (or a custom image with python + node + git).
- **Network:** Isolated bridge network (optional internet access for `npm install`, but strictly monitored).
- **Volume:** Mount the repo code as `read-only` initially, or copy it in for safe mutation. **Recommended:** Copy files into `/workspace` so `rm -rf` doesn't affect the host.

### Implementation
Create `apps/server/src/services/sandbox.ts`:
- `startSandbox()`: Ensures the container is running.
- `executeCommand(cmd: string)`: Uses `docker exec` API to run command and capture stdout/stderr.
- `writeFile(path, content)`: Writes to the sandbox filesystem.
- `readFile(path)`: Reads from the sandbox filesystem.

---

## 2. Sandboxed Terminal Tool

### Usage
- **Tool Name:** `execute_sandboxed_command`
- **Description:** Execute a shell command in the isolated sandbox environment.
- **Input:** `command` (string), `timeout_ms` (number, default: 10000).

### Safety Guardrails
- **Blacklist:** Reject commands like `docker`, `shutdown`, `reboot`.
- **Timeouts:** Kill execution if it runs longer than timeout.
- **Output:** Truncate output to 2000 characters to prevent context overflow (provide a "view more" link if needed).

### Example
**User:** "Run the tests for the login module."
**Agent:** `execute_sandboxed_command("npm test -- login.test.ts")`

---

## 3. REPL / Script Runner

### Usage
- **Tool Name:** `run_analysis_script`
- **Description:** Run a JavaScript or Python script to analyze data.
- **Input:** `code` (string), `language` (enum: ['javascript', 'python']).

### Workflow
1.  Agent provides code (e.g., specific logic to parse a large JSON file).
2.  Service writes code to `/tmp/script.js` inside sandbox.
3.  Service runs `node /tmp/script.js`.
4.  Service returns stdout.

### Use Case
The agent can write a script to calculate complex statistics from a DB dump without hallucinating the math.

---

## Toolpack Configuration

Update `apps/server/src/agent/tool-definitions/toolpacks.ts`:

```typescript
export const EXECUTION_TOOLPACK: ToolpackDefinition = {
  name: 'execution',
  description: 'Safe execution of code and shell commands in an isolated sandbox.',
  defaultCategory: 'core',
  tools: ['execute_sandboxed_command', 'run_analysis_script'],
  sensitiveTools: ['execute_sandboxed_command', 'run_analysis_script'], // Always mark as sensitive
};
```
