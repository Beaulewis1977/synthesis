/**
 * Claude Agent SDK Workaround Test
 *
 * Phase 16A: Test if Claude Agent SDK works with existing Claude Code CLI on WSL2.
 *
 * Known issue: https://github.com/anthropics/claude-agent-sdk-typescript/issues/20
 * The SDK's bundled binary crashes on WSL2. This test checks if pointing to
 * an existing Claude Code installation works around the issue.
 *
 * Run with: pnpm --filter @synthesis/server test src/__tests__/claude-sdk-workaround.test.ts
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Path to existing Claude Code CLI (installed via pnpm)
const CLAUDE_CLI_PATH = '/home/kngpnn/.local/share/pnpm/claude';

describe('Claude Agent SDK WSL2 Workaround', () => {
  describe('Prerequisites', () => {
    it('should have Claude CLI installed at expected path', () => {
      expect(existsSync(CLAUDE_CLI_PATH)).toBe(true);
    });

    it('should have ANTHROPIC_API_KEY environment variable set', () => {
      expect(process.env.ANTHROPIC_API_KEY).toBeDefined();
      expect(process.env.ANTHROPIC_API_KEY?.length).toBeGreaterThan(0);
    });

    it('should be able to execute Claude CLI --version', () => {
      const result = execSync(`${CLAUDE_CLI_PATH} --version`, {
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(result).toContain('Claude Code');
      console.info('Claude CLI version:', result.trim());
    });
  });

  describe('Agent SDK Import', () => {
    it('should be able to import @anthropic-ai/claude-agent-sdk', async () => {
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      expect(sdk.query).toBeDefined();
      expect(typeof sdk.query).toBe('function');
      console.info('Agent SDK imported successfully');
      console.info('Available exports:', Object.keys(sdk));
    });
  });

  describe('Agent Query with Custom CLI Path', () => {
    it('should create a query with pathToClaudeCodeExecutable', async () => {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Create query with custom CLI path - this tests if it can start without WSL2 crash
      const q = query({
        prompt: 'Say exactly "OK" and nothing else.',
        options: {
          pathToClaudeCodeExecutable: CLAUDE_CLI_PATH,
          systemPrompt: 'You are a test agent. Respond with exactly "OK" to any message.',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      expect(q).toBeDefined();
      console.info('Query created successfully with custom CLI path');
    });

    it('should execute a simple query without WSL2 crash', async () => {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      const abortController = new AbortController();

      // Set timeout to abort after 30 seconds
      const timeout = setTimeout(() => {
        abortController.abort();
      }, 30000);

      try {
        const q = query({
          prompt: 'Say exactly "OK" and nothing else.',
          options: {
            pathToClaudeCodeExecutable: CLAUDE_CLI_PATH,
            systemPrompt: 'You are a test agent. Respond with exactly "OK" to any message.',
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            abortController,
          },
        });

        // Iterate through the query results
        let responseText = '';
        for await (const message of q) {
          console.info('Message type:', message.type);
          if (message.type === 'assistant') {
            responseText += message.message.content
              .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
              .map((block) => block.text)
              .join('');
          }
        }

        clearTimeout(timeout);

        console.info('Response received:', responseText);
        expect(responseText.length).toBeGreaterThan(0);
        console.info('SUCCESS: Agent SDK works with custom CLI path on WSL2!');
      } catch (error) {
        clearTimeout(timeout);
        const errorMessage = (error as Error).message;
        console.error('Agent query failed:', errorMessage);

        // Check if it's the known WSL2 crash issue
        if (
          errorMessage.includes('ENOENT') ||
          errorMessage.includes('spawn') ||
          errorMessage.includes('binary')
        ) {
          console.info('FAILURE: WSL2 binary issue detected. Need Docker fallback.');
        }

        // Re-throw to fail the test
        throw error;
      }
    }, 60000); // 60 second timeout for API call
  });
});

/**
 * Manual Test Instructions
 *
 * If the automated test cannot run, test manually:
 *
 * 1. Create a simple test script:
 *    ```typescript
 *    import { query } from '@anthropic-ai/claude-agent-sdk';
 *
 *    const q = query({
 *      prompt: 'Say OK',
 *      options: {
 *        pathToClaudeCodeExecutable: '/home/kngpnn/.local/share/pnpm/claude',
 *        systemPrompt: 'Respond with OK',
 *        permissionMode: 'bypassPermissions',
 *        allowDangerouslySkipPermissions: true,
 *      },
 *    });
 *
 *    for await (const msg of q) {
 *      console.info(msg);
 *    }
 *    ```
 *
 * 2. Expected outcomes:
 *    - SUCCESS: Query returns messages without crash
 *    - FAILURE: Process crashes with ENOENT/spawn error → Need Docker
 */
