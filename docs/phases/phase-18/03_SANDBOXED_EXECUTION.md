# Phase 18.3: Sandboxed Execution Pack

## Overview
This phase implements **Safe Code Execution**. Instead of allowing the agent to run commands on the host machine (high risk), we create a disposable, isolated Docker environment. This allows the agent to run `npm test`, `git`, or Python scripts safely.

**Risk Profile:** High (Code Execution) - Mitigated by Docker Isolation.

---

## 1. The Sandbox Service

### Architecture
We will run a persistent Docker container named `synthesis-sandbox`.
- **Image:** `node:22-alpine` (minimal attack surface; custom image with python + node + git).
- **Network:** Isolated bridge network or `--network=none` for maximum isolation.
- **Volume:** Mount the repo code as `read-only` initially, or copy it in for safe mutation. **Recommended:** Copy files into `/workspace` so `rm -rf` doesn't affect the host.

### Container Security Configuration

Defense-in-depth is required—command whitelisting alone is insufficient:

```yaml
# docker-compose.yml example
synthesis-sandbox:
  image: synthesis-sandbox:latest
  user: "1000:1000"           # Non-root user
  read_only: true              # Read-only root filesystem
  tmpfs:
    - /tmp:size=100M           # Writable tmp with size limit
    - /workspace:size=500M     # Writable workspace
  cap_drop:
    - ALL                      # Drop all Linux capabilities
  security_opt:
    - no-new-privileges:true   # Prevent privilege escalation
    - seccomp:seccomp-profile.json  # Custom seccomp profile
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
  network_mode: none           # Or use allowlist for specific domains
```

**Key security measures:**
- **Non-root user:** UID 1000 prevents root-level access
- **Read-only root FS:** Limits filesystem mutation surface
- **Capabilities:** `--cap-drop=ALL` removes dangerous syscalls
- **Seccomp profile:** Custom profile blocking dangerous system calls
- **Resource limits:** Prevents resource exhaustion attacks
- **Network isolation:** `--network=none` or domain allowlist

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
- **Whitelist:** Only execute commands matching an explicit allowlist of approved binaries and patterns:
  - **Approved commands:** `node`, `npm test`, `npm run`, `python`, `python3`, `git status`, `git diff`, `git log`
  - **Pattern matching:** Commands must match approved patterns (e.g., `npm test -- *.test.ts`)
  - **Adding/removing entries:** Whitelist is configurable via environment or config file; changes require review
  - **Enforcement:** Commands not matching the whitelist are rejected with error: "Command not in approved list"
- **Timeouts:** Kill execution if it runs longer than timeout.
- **Output:** Truncate output to 2000 characters to prevent context overflow (provide a "view more" link if needed). This limit balances readability with token budget; adjust via config if needed.

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
2.  The provided code is written to `/tmp/script.js` inside the sandbox.
3.  Execution runs the script via `node /tmp/script.js`.
4.  Output (stdout) is returned to the agent.

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
