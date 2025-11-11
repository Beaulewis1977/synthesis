import { describe, expect, it } from 'vitest';
import { parseConfigFile } from '../config-analyzer.js';

describe('config-analyzer', () => {
  describe('parseConfigFile', () => {
    it('should parse simple YAML config', async () => {
      const yamlContent = `
database:
  host: localhost
  port: 5432
redis:
  host: localhost
  port: 6379
`;

      const ast = await parseConfigFile(yamlContent, 'config.yml');

      expect(ast.tables).toHaveLength(2);
      expect(ast.tables[0].name).toBe('database');
      expect(ast.tables[0].columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'host', type: 'string' }),
          expect.objectContaining({ name: 'port', type: 'number' }),
        ])
      );
      expect(ast.tables[1].name).toBe('redis');
    });

    it('should parse simple JSON config', async () => {
      const jsonContent = `{
  "database": {
    "host": "localhost",
    "port": 5432
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  }
}`;

      const ast = await parseConfigFile(jsonContent, 'config.json');

      expect(ast.tables).toHaveLength(2);
      expect(ast.tables[0].name).toBe('database');
      expect(ast.tables[0].columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'host', type: 'string' }),
          expect.objectContaining({ name: 'port', type: 'number' }),
        ])
      );
    });

    it('should handle nested structures with dot notation', async () => {
      const yamlContent = `
services:
  web:
    image: nginx
    ports:
      - 80
      - 443
`;

      const ast = await parseConfigFile(yamlContent, 'docker-compose.yml');

      expect(ast.tables).toHaveLength(1);
      expect(ast.tables[0].name).toBe('services');
      expect(ast.tables[0].columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'web.image', type: 'string' }),
          expect.objectContaining({ name: 'web.ports', type: expect.stringContaining('array') }),
        ])
      );
    });

    it('should handle arrays of objects', async () => {
      const jsonContent = `{
  "users": [
    {
      "name": "Alice",
      "age": 30
    }
  ]
}`;

      const ast = await parseConfigFile(jsonContent, 'data.json');

      expect(ast.tables).toHaveLength(1);
      expect(ast.tables[0].columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'users[].name', type: 'string' }),
          expect.objectContaining({ name: 'users[].age', type: 'number' }),
        ])
      );
    });

    it('should limit nested depth', async () => {
      const yamlContent = `
deeply:
  nested:
    structure:
      that:
        goes:
          very:
            deep: value
`;

      const ast = await parseConfigFile(yamlContent, 'deep.yml');

      expect(ast.tables).toHaveLength(1);
      // Should stop at max depth (3 levels)
      const columnNames = ast.tables[0].columns.map((c) => c.name);
      expect(columnNames.some((name) => name.includes('structure.that'))).toBe(true);
    });

    it('should handle malformed YAML gracefully', async () => {
      const malformedYAML = `
database:
  host: localhost
  port: 5432
  invalid: [unclosed
`;

      const ast = await parseConfigFile(malformedYAML, 'bad.yml');

      // Should return empty AST on error
      expect(ast.tables).toHaveLength(0);
      expect(ast.functions).toHaveLength(0);
      expect(ast.indexes).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJSON = `{
  "database": {
    "host": "localhost"
    "port": 5432
  }
}`;

      const ast = await parseConfigFile(malformedJSON, 'bad.json');

      // Should return empty AST on error
      expect(ast.tables).toHaveLength(0);
    });

    it('should handle empty objects and arrays', async () => {
      const yamlContent = `
empty_object: {}
empty_array: []
`;

      const ast = await parseConfigFile(yamlContent, 'empty.yml');

      expect(ast.tables).toHaveLength(2);
      expect(ast.tables[0].columns).toEqual([
        expect.objectContaining({
          name: 'empty_object',
          type: 'object',
          comment: 'Empty object',
        }),
      ]);
      expect(ast.tables[1].columns).toEqual([
        expect.objectContaining({
          name: 'empty_array',
          type: 'array',
          comment: 'Empty array',
        }),
      ]);
    });

    it('should handle null and boolean values', async () => {
      const yamlContent = `
config:
  enabled: true
  disabled: false
  nullable: null
`;

      const ast = await parseConfigFile(yamlContent, 'types.yml');

      expect(ast.tables).toHaveLength(1);
      expect(ast.tables[0].columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'enabled', type: 'boolean' }),
          expect.objectContaining({ name: 'disabled', type: 'boolean' }),
          expect.objectContaining({ name: 'nullable', type: 'null' }),
        ])
      );
    });

    it('should detect format from file extension', async () => {
      const yamlContent = 'key: value';
      const yamlAst = await parseConfigFile(yamlContent, 'file.yaml');
      expect(yamlAst.tables).toHaveLength(1);

      const ymlAst = await parseConfigFile(yamlContent, 'file.yml');
      expect(ymlAst.tables).toHaveLength(1);

      const jsonContent = '{"key": "value"}';
      const jsonAst = await parseConfigFile(jsonContent, 'file.json');
      expect(jsonAst.tables).toHaveLength(1);
    });

    it('should handle unsupported format gracefully', async () => {
      const content = 'key: value';
      const ast = await parseConfigFile(content, 'file.txt');

      // Should return empty AST for unsupported format
      expect(ast.tables).toHaveLength(0);
    });

    it('should never expose secret values in output', async () => {
      const yamlContent = `
secrets:
  api_key: super_secret_key_12345
  password: my_password
  token: bearer_token_xyz
`;

      const ast = await parseConfigFile(yamlContent, 'secrets.yml');

      // Convert entire AST to JSON string
      const astString = JSON.stringify(ast);

      // Verify no secret values appear in output
      expect(astString).not.toContain('super_secret_key_12345');
      expect(astString).not.toContain('my_password');
      expect(astString).not.toContain('bearer_token_xyz');

      // But should have the key names (for searchability)
      expect(ast.tables[0].columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'api_key', type: 'string' }),
          expect.objectContaining({ name: 'password', type: 'string' }),
          expect.objectContaining({ name: 'token', type: 'string' }),
        ])
      );
    });

    it('should include comment metadata', async () => {
      const yamlContent = `
database:
  host: localhost
`;

      const ast = await parseConfigFile(yamlContent, 'config.yml');

      expect(ast.tables[0].comment).toContain('Config section from yaml file');
    });
  });
});
