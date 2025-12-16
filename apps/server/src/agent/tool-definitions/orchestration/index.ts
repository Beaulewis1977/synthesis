/**
 * Orchestration Toolpack Index
 *
 * Exports all tools in the orchestration toolpack for subagent spawning
 * and skill invocation.
 */

import type { UnifiedToolDefinition } from '../types.js';
import { getSubagentStatusTool } from './get-subagent-status.js';
import { invokeSkillTool } from './invoke-skill.js';
import { listSkillsTool } from './list-skills.js';
import { spawnSubagentTool } from './spawn-subagent.js';

/**
 * Orchestration toolpack tools (4 tools)
 */
export const ORCHESTRATION_TOOLS: UnifiedToolDefinition[] = [
  spawnSubagentTool,
  getSubagentStatusTool,
  invokeSkillTool,
  listSkillsTool,
];

export { spawnSubagentTool, getSubagentStatusTool, invokeSkillTool, listSkillsTool };
