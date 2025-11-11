/**
 * Usage Examples for Config Analyzer
 *
 * This file demonstrates how to use the parseConfigFile function
 * to extract structure from YAML and JSON configuration files.
 */

import { parseConfigFile } from './config-analyzer.js';

// Example 1: Parse a YAML configuration file
async function exampleYAML() {
  const yamlContent = `
database:
  host: localhost
  port: 5432
  credentials:
    username: admin
    password: secret

redis:
  host: localhost
  port: 6379
`;

  const ast = await parseConfigFile(yamlContent, 'config.yml');

  console.log('YAML Config Structure:');
  console.log(
    'Tables (sections):',
    ast.tables.map((t) => t.name)
  );

  // Access specific section
  const dbSection = ast.tables.find((t) => t.name === 'database');
  console.log(
    'Database columns:',
    dbSection?.columns.map((c) => `${c.name}: ${c.type}`)
  );
}

// Example 2: Parse a JSON configuration file
async function exampleJSON() {
  const jsonContent = `{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "ssl": {
      "enabled": true,
      "cert": "/path/to/cert.pem"
    }
  },
  "logging": {
    "level": "info",
    "file": "/var/log/app.log"
  }
}`;

  const ast = await parseConfigFile(jsonContent, 'config.json');

  console.log('\nJSON Config Structure:');
  for (const table of ast.tables) {
    console.log(`\n[${table.name}]`);
    for (const col of table.columns) {
      console.log(`  ${col.name}: ${col.type}`);
      if (col.comment) {
        console.log(`    // ${col.comment}`);
      }
    }
  }
}

// Example 3: Parse docker-compose.yml
async function exampleDockerCompose() {
  const dockerCompose = `
version: '3.8'

services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
      - "443:443"
    environment:
      - NODE_ENV=production
      - API_KEY=secret
    volumes:
      - ./html:/usr/share/nginx/html

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
`;

  const ast = await parseConfigFile(dockerCompose, 'docker-compose.yml');

  console.log('\nDocker Compose Structure:');
  const servicesTable = ast.tables.find((t) => t.name === 'services');
  if (servicesTable) {
    console.log('\nService configurations:');
    // Note: Actual values are never exposed, only key paths
    for (const col of servicesTable.columns) {
      console.log(`  ${col.name}: ${col.type}`);
    }
  }
}

// Example 4: Integration with code chunker
async function exampleIntegrationWithChunker() {
  const configContent = `
api:
  base_url: https://api.example.com
  timeout: 30
  retries: 3

features:
  enable_auth: true
  enable_cache: false
  cache_ttl: 3600
`;

  const ast = await parseConfigFile(configContent, 'app-config.yml');

  // The AST can be used for:
  // 1. Chunking config sections for RAG
  // 2. Building searchable metadata
  // 3. Detecting config patterns (feature flags, credentials, etc.)
  // 4. Creating dependency graphs between config files

  console.log('\nConfig sections for chunking:');
  for (const table of ast.tables) {
    console.log(`\nSection: ${table.name}`);
    console.log(`  Keys: ${table.columns.length}`);
    console.log(`  Comment: ${table.comment}`);

    // Each section can be a separate chunk
    const chunkText = `${table.name} section with keys: ${table.columns.map((c) => c.name).join(', ')}`;
    console.log(`  Chunk preview: ${chunkText}`);
  }
}

// Example 5: Security - verify secrets are not exposed
async function exampleSecurityCheck() {
  const secretsConfig = `
production:
  api_key: sk-1234567890abcdef
  database_url: postgres://user:password@localhost/db
  oauth:
    client_id: abc123
    client_secret: xyz789
`;

  const ast = await parseConfigFile(secretsConfig, 'secrets.yml');

  // Convert AST to string to verify no secrets leaked
  const astString = JSON.stringify(ast);

  console.log('\nSecurity Check:');
  console.log('AST contains secret values?', astString.includes('sk-1234567890abcdef'));
  // Should be false - only key names are stored, never values

  console.log('Key paths extracted:');
  const productionSection = ast.tables.find((t) => t.name === 'production');
  console.log(productionSection?.columns.map((c) => c.name));
  // Shows: ['api_key', 'database_url', 'oauth.client_id', 'oauth.client_secret']
}

// Run examples (uncomment to test)
// exampleYAML();
// exampleJSON();
// exampleDockerCompose();
// exampleIntegrationWithChunker();
// exampleSecurityCheck();

export {
  exampleYAML,
  exampleJSON,
  exampleDockerCompose,
  exampleIntegrationWithChunker,
  exampleSecurityCheck,
};
