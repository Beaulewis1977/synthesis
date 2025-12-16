/**
 * Skill Loader Service
 *
 * Loads skills from the .claude/skills/ directory.
 * Skills are markdown files with YAML frontmatter containing name and description.
 *
 * Supports two directory patterns:
 * 1. Single file: .claude/skills/{name}.md
 * 2. Directory: .claude/skills/{name}/SKILL.md
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Project Root Detection
// =============================================================================

/**
 * Find the project root by walking up from current file location.
 * Looks for .claude directory which indicates the project root.
 */
function findProjectRoot(): string {
  // Start from this file's directory
  const currentDir = dirname(fileURLToPath(import.meta.url));

  // Walk up looking for .claude directory or pnpm-workspace.yaml
  let dir = currentDir;
  for (let i = 0; i < 10; i++) {
    // Check for .claude directory (skills location)
    const claudeDir = join(dir, '.claude');
    if (existsSync(claudeDir)) {
      return dir;
    }

    // Check for pnpm-workspace.yaml (monorepo root indicator)
    const workspaceFile = join(dir, 'pnpm-workspace.yaml');
    if (existsSync(workspaceFile)) {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) break; // Reached filesystem root
    dir = parent;
  }

  // Fallback to process.cwd()
  return process.cwd();
}

// =============================================================================
// Types
// =============================================================================

export interface Skill {
  /** Skill name (from frontmatter or directory name) */
  name: string;
  /** Skill description (from frontmatter) */
  description: string;
  /** Full skill content (markdown body after frontmatter) */
  content: string;
  /** Source location */
  source: 'file';
  /** Path to the skill file */
  path: string;
}

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

// =============================================================================
// Skill Loader Class
// =============================================================================

export class SkillLoader {
  private skillsDir: string;

  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir ?? join(findProjectRoot(), '.claude', 'skills');
  }

  /**
   * Load a skill by name
   * @param name Skill name (without .md extension)
   * @returns Skill object or null if not found
   */
  async load(name: string): Promise<Skill | null> {
    // Try directory pattern first: .claude/skills/{name}/SKILL.md
    const dirPath = join(this.skillsDir, name, 'SKILL.md');
    try {
      const dirStat = await stat(dirPath);
      if (dirStat.isFile()) {
        return this.loadFromPath(dirPath, name);
      }
    } catch {
      // Directory pattern not found, try single file
    }

    // Try single file pattern: .claude/skills/{name}.md
    const filePath = join(this.skillsDir, `${name}.md`);
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        return this.loadFromPath(filePath, name);
      }
    } catch {
      // File not found
    }

    return null;
  }

  /**
   * Load skill from a specific path
   */
  private async loadFromPath(filePath: string, fallbackName: string): Promise<Skill> {
    const content = await readFile(filePath, 'utf-8');
    const { frontmatter, body } = this.parseFrontmatter(content);

    return {
      name: frontmatter.name ?? fallbackName,
      description: frontmatter.description ?? '',
      content: body,
      source: 'file',
      path: filePath,
    };
  }

  /**
   * List all available skills
   * @returns Array of skill objects
   */
  async listAll(): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      const entries = await readdir(this.skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip non-md files and special files
        if (entry.name.startsWith('.') || entry.name === 'skill-rules.json') {
          continue;
        }

        if (entry.isDirectory()) {
          // Directory pattern: .claude/skills/{name}/SKILL.md
          const skillPath = join(this.skillsDir, entry.name, 'SKILL.md');
          try {
            const skill = await this.loadFromPath(skillPath, entry.name);
            skills.push(skill);
          } catch {
            // No SKILL.md in directory, skip
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          // Single file pattern: .claude/skills/{name}.md
          const skillName = basename(entry.name, '.md');
          const skillPath = join(this.skillsDir, entry.name);
          try {
            const skill = await this.loadFromPath(skillPath, skillName);
            skills.push(skill);
          } catch {
            // Failed to load, skip
          }
        }
      }
    } catch (error) {
      // Skills directory doesn't exist or can't be read
      console.warn(`[SkillLoader] Could not read skills directory: ${this.skillsDir}`, error);
    }

    return skills;
  }

  /**
   * Parse YAML frontmatter from markdown content
   */
  private parseFrontmatter(content: string): { frontmatter: ParsedFrontmatter; body: string } {
    // Match YAML frontmatter between --- markers
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

    if (!match) {
      return { frontmatter: {}, body: content.trim() };
    }

    const [, frontmatterRaw, body] = match;
    const frontmatter = this.parseSimpleYaml(frontmatterRaw);

    return { frontmatter, body: body.trim() };
  }

  /**
   * Simple YAML parser for frontmatter (handles basic key: value pairs)
   * Avoids adding yaml dependency for simple use case
   */
  private parseSimpleYaml(yamlContent: string): ParsedFrontmatter {
    const result: ParsedFrontmatter = {};

    for (const line of yamlContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let instance: SkillLoader | null = null;

/**
 * Get the singleton SkillLoader instance
 */
export function getSkillLoader(skillsDir?: string): SkillLoader {
  if (!instance) {
    instance = new SkillLoader(skillsDir);
  }
  return instance;
}
