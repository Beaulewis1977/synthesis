# Phase 18.2: DevOps Automation Pack

## Overview
The **DevOps Automation Pack** allows the agent to act as a "Level 1 Site Reliability Engineer". It can check build statuses, toggle feature flags to remediate incidents, and file tickets for human review.

**Risk Profile:** Medium (Write access to tickets/flags, Read access to infra).

---

## 1. Deployment Status

### Usage
- **Tool Name:** `check_deployment_status`
- **Description:** Check the status of the latest deployment or build workflow.
- **Input:** `platform` (enum: ['vercel', 'GitHub']), `project` (string).

### Implementation Details
- **Vercel:** Use Vercel API to get latest deployment status for the project.
- **GitHub:** Use GitHub Actions API (`GET /repos/{owner}/{repo}/actions/runs`) to find latest run status.
- **Agent Value:** "My code is merged but not showing up. Agent, is the build stuck?"
- **Location:** `apps/server/src/agent/tool-definitions/devops/deployment.ts`

---

## 2. Feature Flag Toggling

### Usage
- **Tool Name:** `manage_feature_flag`
- **Description:** Enable or disable a feature flag.
- **Input:** `flag_key` (string), `state` (boolean), `reason` (string, required).

### Input Validation
- `flag_key`: Must match pattern `^[a-z][a-z0-9_]{2,50}$` (lowercase, underscores only)
- `reason`: Required, 10-500 characters, alphanumeric + spaces + basic punctuation only
- Log entries must be sanitized to prevent log injection (remove newlines, control characters)
- Rate limit: Max 5 flag changes per agent session per hour

### Implementation Details
- **Storage:** If using a DB table `feature_flags`, execute update. If using LaunchDarkly/PostHog, use their API.
- **Audit:** **CRITICAL**. Every toggle action must be logged to a specialized audit channel (e.g., Slack webhook or DB audit log) with the `reason` provided by the agent.
- **Safe Mode:** Initially, allow only toggling specific "safe" flags (e.g., `maintenance_mode`, `beta_features`).
- **Location:** `apps/server/src/agent/tool-definitions/devops/feature-flags.ts`

---

## 3. Ticket Management (Linear/Jira)

### Usage
- **Tool Name:** `create_ticket`
- **Description:** Create a new issue/ticket in the project management system.
- **Input:** `title` (string), `description` (string), `priority` (enum: ['p1', 'p2', 'p3']), `labels` (string[]).

### Implementation Details
- **Linear API:** Create issue graphQL mutation.
- **Jira API:** Create issue REST endpoint.
- **Workflow:**
    1.  Agent identifies a bug it cannot fix.
    2.  Agent summarizes the findings.
    3.  Agent calls `create_ticket` with the summary.
- **Location:** `apps/server/src/agent/tool-definitions/devops/ticketing.ts`

---

## Toolpack Configuration

Update `apps/server/src/agent/tool-definitions/toolpacks.ts`:

```typescript
export const DEVOPS_TOOLPACK: ToolpackDefinition = {
  name: 'devops',
  description: 'Infrastructure and Project Management automation.',
  defaultCategory: 'core',
  tools: ['check_deployment_status', 'manage_feature_flag', 'create_ticket'],
  sensitiveTools: ['manage_feature_flag'], // Toggling flags is sensitive
};
```
