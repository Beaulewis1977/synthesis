/**
 * List Skills Tool Definition
 *
 * Lists all available skills with their names and descriptions.
 * Skills are loaded from the .claude/skills/ directory.
 */

import { z } from 'zod';
import { getSkillLoader } from '../../../services/skill-loader.js';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const listSkillsInputSchema = z.object({});

// =============================================================================
// Tool Definition
// =============================================================================

export const listSkillsTool: UnifiedToolDefinition = {
  name: 'list_skills',
  description:
    'List all available skills with their names and descriptions. Use this to discover what specialized knowledge is available before invoking a skill.',
  inputSchema: listSkillsInputSchema,
  metadata: {
    toolpack: 'orchestration',
    category: 'orchestration',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async () => {
    const loader = getSkillLoader();
    const skills = await loader.listAll();

    if (skills.length === 0) {
      return createToolResponse('No skills found.', {
        skills: [],
        total: 0,
        message: 'No skills found in .claude/skills/ directory.',
      });
    }

    const skillSummaries = skills.map((s) => ({
      name: s.name,
      description: s.description || '(no description)',
      path: s.path,
    }));

    return createToolResponse(`Found ${skills.length} skill(s).`, {
      skills: skillSummaries,
      total: skills.length,
    });
  },
};
