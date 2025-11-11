import { describe, expect, it } from 'vitest';
import { parseConfigFile } from '../config-analyzer.js';

describe('config-analyzer - real-world examples', () => {
  it('should parse docker-compose.yml structure', async () => {
    const dockerComposeYAML = `
version: '3.8'

services:
  synthesis-db:
    image: pgvector/pgvector:pg16
    container_name: synthesis-db
    environment:
      POSTGRES_DB: synthesis
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - synthesis-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  synthesis-ollama:
    image: ollama/ollama:latest
    container_name: synthesis-ollama
    ports:
      - "11434:11434"
    volumes:
      - synthesis-ollama-data:/root/.ollama

volumes:
  synthesis-db-data:
  synthesis-ollama-data:
`;

    const ast = await parseConfigFile(dockerComposeYAML, 'docker-compose.yml');

    expect(ast.tables).toHaveLength(3);
    expect(ast.tables.map((t) => t.name)).toEqual(['version', 'services', 'volumes']);

    // Check services section structure
    const servicesTable = ast.tables.find((t) => t.name === 'services');
    expect(servicesTable).toBeDefined();
    expect(servicesTable?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'synthesis-db.image', type: 'string' }),
        expect.objectContaining({ name: 'synthesis-db.container_name', type: 'string' }),
        expect.objectContaining({
          name: 'synthesis-db.ports',
          type: expect.stringContaining('array'),
        }),
        expect.objectContaining({
          name: 'synthesis-db.healthcheck.interval',
          type: expect.stringContaining('string'),
        }),
      ])
    );
  });

  it('should parse tsconfig.json structure', async () => {
    const tsconfigJSON = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`;

    const ast = await parseConfigFile(tsconfigJSON, 'tsconfig.json');

    expect(ast.tables).toHaveLength(3);
    expect(ast.tables.map((t) => t.name)).toEqual(['compilerOptions', 'include', 'exclude']);

    // Check compilerOptions section
    const compilerOptions = ast.tables.find((t) => t.name === 'compilerOptions');
    expect(compilerOptions?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'target', type: 'string' }),
        expect.objectContaining({ name: 'module', type: 'string' }),
        expect.objectContaining({ name: 'strict', type: 'boolean' }),
        expect.objectContaining({ name: 'lib', type: expect.stringContaining('array') }),
      ])
    );
  });

  it('should parse package.json structure', async () => {
    const packageJSON = `{
  "name": "@synthesis/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^4.28.1",
    "pg": "^8.12.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.4"
  }
}`;

    const ast = await parseConfigFile(packageJSON, 'package.json');

    expect(ast.tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['name', 'version', 'scripts', 'dependencies', 'devDependencies'])
    );

    // Check scripts section
    const scripts = ast.tables.find((t) => t.name === 'scripts');
    expect(scripts?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dev', type: 'string' }),
        expect.objectContaining({ name: 'build', type: 'string' }),
        expect.objectContaining({ name: 'test', type: 'string' }),
      ])
    );

    // Check dependencies
    const dependencies = ast.tables.find((t) => t.name === 'dependencies');
    expect(dependencies?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'fastify', type: 'string' }),
        expect.objectContaining({ name: 'pg', type: 'string' }),
      ])
    );
  });

  it('should parse .env-style YAML config', async () => {
    const envConfigYAML = `
database:
  url: postgresql://user:pass@localhost:5432/db
  pool:
    min: 2
    max: 10

server:
  port: 3333
  host: 0.0.0.0

features:
  enable_caching: true
  enable_logging: false
  log_level: info
`;

    const ast = await parseConfigFile(envConfigYAML, 'config.yml');

    expect(ast.tables.map((t) => t.name)).toEqual(['database', 'server', 'features']);

    // Verify nested database config
    const database = ast.tables.find((t) => t.name === 'database');
    expect(database?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'url', type: 'string' }),
        expect.objectContaining({ name: 'pool.min', type: 'number' }),
        expect.objectContaining({ name: 'pool.max', type: 'number' }),
      ])
    );

    // Verify feature flags
    const features = ast.tables.find((t) => t.name === 'features');
    expect(features?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'enable_caching', type: 'boolean' }),
        expect.objectContaining({ name: 'enable_logging', type: 'boolean' }),
        expect.objectContaining({ name: 'log_level', type: 'string' }),
      ])
    );
  });

  it('should parse GitHub Actions workflow YAML', async () => {
    const workflowYAML = `
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
`;

    const ast = await parseConfigFile(workflowYAML, '.github/workflows/ci.yml');

    expect(ast.tables.map((t) => t.name)).toEqual(['name', 'on', 'jobs']);

    // Check jobs structure
    const jobs = ast.tables.find((t) => t.name === 'jobs');
    expect(jobs?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'test.runs-on', type: 'string' }),
        // Note: steps[] hits depth limit due to nested array structure
        expect.objectContaining({ name: 'test.steps[]', type: 'object' }),
      ])
    );
  });

  it('should handle Kubernetes-style config with complex arrays', async () => {
    const k8sYAML = `
apiVersion: v1
kind: Service
metadata:
  name: my-service
  labels:
    app: myapp
spec:
  selector:
    app: myapp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 8080
    - name: https
      protocol: TCP
      port: 443
      targetPort: 8443
`;

    const ast = await parseConfigFile(k8sYAML, 'service.yaml');

    expect(ast.tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['apiVersion', 'kind', 'metadata', 'spec'])
    );

    // Check spec.ports array structure
    const spec = ast.tables.find((t) => t.name === 'spec');
    expect(spec?.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'ports[].name', type: 'string' }),
        expect.objectContaining({ name: 'ports[].protocol', type: 'string' }),
        expect.objectContaining({ name: 'ports[].port', type: 'number' }),
        expect.objectContaining({ name: 'ports[].targetPort', type: 'number' }),
      ])
    );
  });
});
