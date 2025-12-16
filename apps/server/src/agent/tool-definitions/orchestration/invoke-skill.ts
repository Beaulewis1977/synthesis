/**
 * Invoke Skill Tool Definition
 *
 * Loads and returns a specialized skill for domain-specific knowledge.
 * Skills are markdown files with best practices, patterns, and workflows.
 */

import { z } from 'zod';
import { getSkillLoader } from '../../../services/skill-loader.js';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const invokeSkillInputSchema = z.object({
  skill: z
    .string()
    .min(1, 'skill name must not be empty')
    .describe(
      'Skill name to load (e.g., "synthesis-architecture", "llm-provider-integration", "sse-streaming")'
    ),
});

type InvokeSkillInput = z.infer<typeof invokeSkillInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const invokeSkillTool: UnifiedToolDefinition = {
  name: 'invoke_skill',
  description: `Load and invoke a specialized skill for domain-specific knowledge. Returns the skill content with best practices, patterns, and workflows.

Skills are markdown documents containing expert guidance for specific domains. Use list_skills first to see available skills.

Example skills:
- synthesis-architecture: Routes, services, agent tools patterns
- llm-provider-integration: Multi-provider LLM integration
- sse-streaming: Server-Sent Events for Fastify + React`,
  inputSchema: invokeSkillInputSchema,
  metadata: {
    toolpack: 'orchestration',
    category: 'orchestration',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async (input: unknown) => {
    const parsed = invokeSkillInputSchema.parse(input) as InvokeSkillInput;

    const loader = getSkillLoader();
    const skill = await loader.load(parsed.skill);

    if (!skill) {
      // Get available skills to suggest alternatives
      const availableSkills = await loader.listAll();
      const skillNames = availableSkills.map((s) => s.name);

      return createToolResponse(`Skill "${parsed.skill}" not found.`, {
        error: 'not_found',
        requested_skill: parsed.skill,
        available_skills: skillNames,
        suggestion:
          skillNames.length > 0
            ? `Available skills: ${skillNames.join(', ')}`
            : 'No skills found in .claude/skills/ directory.',
      });
    }

    return createToolResponse(`Loaded skill: ${skill.name}`, {
      name: skill.name,
      description: skill.description,
      content: skill.content,
      source: skill.source,
      path: skill.path,
    });
  },
};
