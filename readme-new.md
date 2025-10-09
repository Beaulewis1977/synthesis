# 🤖 Synthesis RAG

**An Enterprise-Grade Autonomous RAG System for Multi-Project Documentation Management**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A sophisticated RAG (Retrieval-Augmented Generation) system that autonomously manages documentation across multiple projects, featuring advanced vector search, intelligent document processing, and AI-powered tools.

---

## 🎯 **What is Synthesis RAG?**

Synthesis RAG is a production-ready autonomous documentation management system that combines:

- **🧠 Advanced AI Integration** - Claude 3.7 Sonnet with custom tool orchestration
- **🔍 Vector Search** - PostgreSQL + pgvector with HNSW indexing for lightning-fast similarity search
- **📄 Multi-Format Support** - PDF, DOCX, Markdown, plain text, and web content ingestion
- **🤖 Autonomous Agents** - 9 comprehensive tools for document management and analysis
- **🏗️ Enterprise Architecture** - Scalable monorepo with comprehensive testing and Docker deployment

---

## 🚀 **Key Features**

### **📚 Intelligent Document Processing**
- **Multi-format ingestion**: PDF, DOCX, Markdown, TXT
- **Web content crawling** with Playwright automation
- **Semantic chunking** that respects document structure
- **Background processing** with real-time status tracking
- **Error recovery** and retry mechanisms

### **🔍 Advanced Search & Retrieval**
- **Vector similarity search** with cosine distance
- **HNSW indexing** for sub-linear search performance
- **Collection-scoped queries** for multi-project support
- **Citation tracking** with source attribution
- **Configurable similarity thresholds**

### **🤖 Autonomous Agent System**
- **9 specialized tools** for complete document lifecycle management
- **Multi-turn conversations** with context preservation
- **Streaming responses** for real-time interaction
- **Type-safe tool validation** with Zod schemas
- **Usage tracking** and error handling

### **🏗️ Production-Ready Architecture**
- **PostgreSQL + pgvector** for scalable vector storage
- **Fastify backend** with TypeScript strict mode
- **React frontend** (ready for implementation)
- **Docker Compose** deployment with GPU support
- **Comprehensive testing** (28 tests, 100% passing)

---

## 💝 **Support This Project**

**Designed & Built by [Beau Lewis](mailto:blewisxx@gmail.com)**

This is an open-source project developed with passion and dedication. If you find Synthesis RAG valuable and would like to support its continued development:

- 💰 **Venmo**: [@beauintulsa](https://venmo.com/beauintulsa)
- ☕ **Ko-fi**: [beaulewis](https://ko-fi.com/beaulewis)

Your support helps maintain and improve this project for the entire community. Every contribution, no matter the size, is deeply appreciated! 🙏

---

## 📦 **Quick Start**

### **Prerequisites**
- **Node.js 22+** with pnpm
- **Docker & Docker Compose**
- **PostgreSQL 16** (or use Docker)
- **NVIDIA GPU** (optional, for Ollama acceleration)

### **🚀 Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/synthesis-rag.git
   cd synthesis-rag
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   cp apps/server/.env.example apps/server/.env
   # Edit .env files with your configuration
   ```

4. **Start with Docker** (Recommended)
   ```bash
   # Start infrastructure (database + Ollama)
   docker-compose --profile infrastructure up -d
   
   # Run database migrations
   cd packages/db && pnpm run migrate
   
   # Start the development server
   cd apps/server && pnpm run dev
   ```

5. **Access the system**
   - **API**: http://localhost:3001
   - **Ollama**: http://localhost:11434
   - **Database**: localhost:5432

---

## 🛠️ **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Web    │    │  Fastify API    │    │  PostgreSQL +   │
│   Frontend      │◄──►│    Server       │◄──►│   pgvector      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │     Ollama      │
                       │  (Embeddings)   │
                       └─────────────────┘
```

### **Core Components**

- **`apps/server`** - Fastify backend with RAG pipeline and agent system
- **`apps/web`** - React frontend for document management UI
- **`apps/mcp`** - Model Context Protocol server integration
- **`packages/db`** - Database layer with pgvector and migrations
- **`packages/shared`** - Shared utilities and types

---

## 🤖 **Agent Tools**

Synthesis RAG includes 9 powerful tools for autonomous document management:

| Tool | Description | Use Case |
|------|-------------|----------|
| **`search_rag`** | Vector similarity search with citations | Find relevant information across documents |
| **`add_document`** | Ingest files or URLs with auto-processing | Add new content to collections |
| **`fetch_web_content`** | Crawl and extract web content | Import documentation from websites |
| **`list_collections`** | Manage and browse collections | Organize documents by project |
| **`list_documents`** | View documents with status filters | Monitor ingestion progress |
| **`get_document_status`** | Check processing pipeline status | Debug failed ingestions |
| **`delete_document`** | Safely remove documents | Clean up obsolete content |
| **`restart_ingest`** | Retry failed document processing | Recover from processing errors |
| **`summarize_document`** | Generate AI-powered summaries | Quick document overviews |

---

## 📊 **Performance & Scalability**

### **Database Optimization**
- **HNSW vector indexing** for O(log n) search complexity
- **Connection pooling** for efficient resource management
- **Batch operations** for optimized chunk storage
- **Collection-based partitioning** for multi-tenancy

### **Processing Pipeline**
- **Asynchronous document processing** with status tracking
- **Semantic chunking** that respects document boundaries
- **Retry mechanisms** for failed operations
- **Streaming responses** for real-time feedback

### **Benchmarks** (Typical Performance)
- **Vector search**: <100ms for 10K+ documents
- **Document ingestion**: ~2-5 seconds per document
- **Embedding generation**: ~500ms per chunk
- **Test suite**: <2 seconds (28 tests)

---

## 🧪 **Development**

### **Available Scripts**

```bash
# Install dependencies
pnpm install

# Development
pnpm run dev          # Start development server
pnpm run dev:web      # Start React development server

# Testing
pnpm run test         # Run all tests
pnpm run test:watch   # Run tests in watch mode

# Building
pnpm run build        # Build all packages
pnpm run build:server # Build server only

# Database
pnpm run db:migrate   # Run database migrations
pnpm run db:seed      # Seed with sample data

# Linting & Formatting
pnpm run lint         # Lint all code
pnpm run format       # Format all code
pnpm run typecheck    # Type checking
```

### **Project Structure**

```
synthesis-rag/
├── apps/
│   ├── server/           # Fastify backend
│   │   ├── src/
│   │   │   ├── agent/    # AI agent system
│   │   │   ├── pipeline/ # Document processing
│   │   │   ├── routes/   # API endpoints
│   │   │   └── services/ # Business logic
│   │   └── __tests__/    # Test suites
│   ├── web/              # React frontend
│   └── mcp/              # MCP server
├── packages/
│   ├── db/               # Database layer
│   │   ├── migrations/   # SQL migrations
│   │   └── src/          # Query builders
│   └── shared/           # Shared utilities
├── docs/                 # Comprehensive documentation
└── scripts/              # Automation scripts
```

---

## 🐳 **Docker Deployment**

### **Production Deployment**

```bash
# Full stack deployment
docker-compose up -d

# Infrastructure only (database + Ollama)
docker-compose --profile infrastructure up -d

# With GPU support for Ollama
docker-compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

### **Environment Variables**

```bash
# Core Configuration
ANTHROPIC_API_KEY=your_claude_api_key
DATABASE_URL=postgresql://user:pass@localhost:5432/synthesis
OLLAMA_BASE_URL=http://localhost:11434

# Optional Configuration
EMBEDDING_MODEL=nomic-embed-text
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
SIMILARITY_THRESHOLD=0.7
```

---

## 📚 **API Documentation**

### **Core Endpoints**

#### **Collections**
```bash
GET    /api/collections              # List all collections
POST   /api/collections              # Create new collection
GET    /api/collections/:id/docs     # List documents in collection
```

#### **Documents**
```bash
POST   /api/ingest                   # Ingest new document
GET    /api/documents/:id            # Get document details
DELETE /api/documents/:id            # Delete document
POST   /api/documents/:id/restart    # Restart failed ingestion
```

#### **Search**
```bash
POST   /api/search                   # Vector similarity search
POST   /api/search/collections/:id   # Collection-scoped search
```

#### **Agent**
```bash
POST   /api/agent/chat               # Chat with agent
GET    /api/agent/tools              # List available tools
```

### **Example Usage**

```javascript
// Search across all collections
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'How to deploy with Docker?',
    limit: 5,
    threshold: 0.7
  })
});

// Chat with agent
const chatResponse = await fetch('/api/agent/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Search for Docker deployment instructions' }
    ]
  })
});
```

---

## 🧪 **Testing**

The project includes comprehensive testing with **28 tests** across **7 test suites**:

```bash
# Run all tests
pnpm run test

# Run specific test suite
pnpm run test agent.test.ts
pnpm run test pipeline/

# Coverage report
pnpm run test:coverage
```

### **Test Coverage**
- ✅ **Unit tests** for all core components
- ✅ **Integration tests** for pipeline orchestration  
- ✅ **Mocked dependencies** (Playwright, Anthropic, Database)
- ✅ **Error handling** and edge cases
- ✅ **Performance benchmarks**

---

## 🔧 **Configuration**

### **Database Configuration**
```sql
-- Required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Recommended settings for production
shared_preload_libraries = 'pg_stat_statements'
max_connections = 100
shared_buffers = 256MB
```

### **Ollama Configuration**
```bash
# Pull required embedding model
ollama pull nomic-embed-text

# Optional: Pull larger models for better performance
ollama pull all-minilm:l6-v2
```

---

## 🚀 **Roadmap**

### **✅ Completed (Phases 1-3)**
- [x] Core RAG pipeline with vector search
- [x] Multi-format document ingestion
- [x] Autonomous agent system with 9 tools
- [x] PostgreSQL + pgvector integration
- [x] Docker deployment configuration
- [x] Comprehensive testing suite

### **🚧 In Progress**
- [ ] React frontend UI implementation
- [ ] Authentication and user management
- [ ] Real-time collaboration features

### **📋 Planned**
- [ ] Advanced caching with Redis
- [ ] Observability and monitoring
- [ ] API rate limiting and quotas
- [ ] Enhanced security features
- [ ] Mobile-responsive UI
- [ ] Plugin architecture

---

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Setup**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`pnpm install`)
4. Make your changes and add tests
5. Run the test suite (`pnpm run test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### **Code Standards**
- **TypeScript strict mode** enforced
- **Biome** for linting and formatting
- **Comprehensive tests** required for new features
- **Documentation** updates for API changes

---

## 🛡️ **Security**

- **Input validation** with Zod schemas
- **Parameterized queries** prevent SQL injection
- **Environment variable** configuration
- **Docker isolation** for deployment
- **No hardcoded secrets** in codebase

For security issues, please email [blewisxx@gmail.com](mailto:blewisxx@gmail.com).

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Anthropic** for Claude 3.7 Sonnet API
- **Ollama** for local embedding models
- **pgvector** for PostgreSQL vector extensions
- **The open-source community** for amazing tools and libraries

---

## 📞 **Support & Contact**

- **Issues**: [GitHub Issues](https://github.com/yourusername/synthesis-rag/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/synthesis-rag/discussions)
- **Email**: [blewisxx@gmail.com](mailto:blewisxx@gmail.com)
- **Documentation**: [Full Documentation](docs/README.md)

---

<div align="center">

**Built with ❤️ by [Beau Lewis](mailto:blewisxx@gmail.com)**

*If this project helps you, consider supporting its development!*

[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/beaulewis)
[![Venmo](https://img.shields.io/badge/Venmo-008CFF?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/beauintulsa)

⭐ **Star this repo if you find it useful!** ⭐

</div>