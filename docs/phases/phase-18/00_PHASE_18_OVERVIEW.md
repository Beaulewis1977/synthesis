# Phase 18: Advanced Agent Capabilities & Custom Tools

## Overview
This phase marks a significant evolution of the Synthesis RAG system, moving from passive information retrieval to **active agentic execution**. By leveraging the Claude Agent SDK (TypeScript) and the Model Context Protocol (MCP), we will empower the agent to interact with live code, infrastructure, and even graphical user interfaces.

**Primary Goal:** Transform the Synthesis Agent into a capable "Engineering Companion" that can debug, deploy, and fix issues autonomously within safe, defined boundaries.

## Architecture & Technology
- **SDK:** `claude-agent-sdk-ts` (TypeScript)
- **Protocol:** Model Context Protocol (MCP) for tool exposure.
- **Runtime:** specific Docker containers for sandboxed execution.
- **GUI:** Xvfb + VNC for "Computer Use" capabilities.

## Workstreams

This phase is divided into four distinct sub-phases, each adding a layer of capability:

### 18.1 Code Intelligence Pack (High Value, Low Risk)
*Goal:* Give the agent "read" access to live system state.
*   **Database Query Tool:** Read-only Postgres access for ad-hoc data analysis.
*   **Code Search:** Deep semantic search across GitHub/Greptile for usage patterns.
*   **Log Analyzer:** Fetching and analyzing live logs from Cloudflare/Supabase.
*   *See [01_CODE_INTELLIGENCE.md](./01_CODE_INTELLIGENCE.md)*

### 18.2 DevOps Automation Pack
*Goal:* Allow the agent to interact with the SDLC infrastructure.
*   **Deployment Checks:** Verify status of Vercel/GitHub Actions builds.
*   **Feature Flags:** Toggle LaunchDarkly/DB flags.
*   **Ticket Management:** Create and update Linear/Jira tickets.
*   *See [02_DEVOPS_AUTOMATION.md](./02_DEVOPS_AUTOMATION.md)*

### 18.3 Sandboxed Execution Pack (Powerful)
*Goal:* Safe, isolated code execution.
*   **Docker Sandbox:** A dedicated `synthesis-sandbox` container.
*   **Sandboxed Terminal:** `execute_command` tool running inside the container.
*   **REPL/Interpreter:** Node.js/Python environment for data analysis scripts.
*   *See [03_SANDBOXED_EXECUTION.md](./03_SANDBOXED_EXECUTION.md)*

### 18.4 Computer Use Pack (Cutting Edge)
*Goal:* GUI interaction capabilities.
*   **Virtual Display:** Xvfb setup in Docker.
*   **Computer Tools:** Mouse move, click, type, screenshot.
*   **Use Cases:** Browser automation, UI verification.
*   *See [04_COMPUTER_USE.md](./04_COMPUTER_USE.md)*

## Context Window Strategy
To prevent context overflow, all new tools will be grouped into **Toolpacks**:
- `intelligence_pack`
- `devops_pack`
- `execution_pack`
- `computer_use_pack`

The Agent will use the existing `discover_tools` / `enable_tools` Gateway pattern to load these capabilities only when needed.

## Implementation Order
We recommend implementing in the order listed (18.1 -> 18.4), as risk and complexity increase with each step.
