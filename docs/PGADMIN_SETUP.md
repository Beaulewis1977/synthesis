# pgAdmin Setup Guide for Synthesis RAG

This guide will help you connect pgAdmin to your Synthesis RAG database.

## ✅ Prerequisites

1. **Docker is running** with the database container started:
   ```bash
   docker compose up -d synthesis-db
   ```

2. **pgAdmin is installed** on your system (desktop app or web version)

---

## 🔧 Connection Configuration

### Step 1: Create a New Server

1. Open pgAdmin
2. Right-click on **"Servers"** in the left panel
3. Select **Register → Server**

### Step 2: General Tab

- **Name:** `Synthesis RAG` (or any name you prefer)

### Step 3: Connection Tab

Use these **exact values** from your `docker-compose.yml`:

| Field | Value | Description |
|-------|-------|-------------|
| **Host name/address** | `localhost` | Recommended. (Windows pgAdmin can use `127.0.0.1`; avoid `synthesis-db`.) |
| **Port** | `5432` | Default PostgreSQL port |
| **Maintenance database** | `synthesis` | Your RAG database name |
| **Username** | `postgres` | Database user |
| **Password** | `postgres` | Database password |
| **Save password?** | ✅ (Recommended) | Saves you from re-entering |

### Step 4: SSL Tab (Optional)

- **SSL mode:** `Prefer` (default is fine)

### Step 5: Advanced Tab (Optional)

- **DB restriction:** `synthesis` 
  - This restricts pgAdmin to only show the `synthesis` database
  - Makes the UI cleaner

### Step 6: Save

Click **"Save"** and pgAdmin should connect!

---

## 📊 What You'll See

Once connected, you should see:

### **Database Structure:**
```
Synthesis RAG (server)
└── Databases
    └── synthesis
        ├── Extensions
        │   ├── pgcrypto (1.3) - cryptographic functions
        │   ├── plpgsql (1.0) - procedural language
        │   └── vector (0.6.0) - pgvector for embeddings ⭐
        └── Schemas
            └── public
                └── Tables
                    ├── chunks - Text chunks with embeddings
                    ├── collections - Document collections
                    ├── documents - Uploaded documents
                    └── migrations - Schema version tracking
```

### **Key Tables:**

1. **collections** - Organizes documents into groups
   - `id`, `name`, `description`, `created_at`, `updated_at`

2. **documents** - Stores metadata about uploaded files
   - `id`, `collection_id`, `filename`, `mime_type`, `size`, etc.

3. **chunks** - Text chunks with vector embeddings for RAG
   - `id`, `document_id`, `content`, `embedding` (vector type), `metadata`

4. **migrations** - Tracks database schema versions

---

## 🔍 Troubleshooting

### Issue 1: "Could not connect to server"

**Symptom:** pgAdmin shows "could not connect to server: Connection refused"

**Solutions:**
1. Verify the database container is running:
   ```bash
   docker compose ps synthesis-db
   ```
   Should show status as "Up" and "healthy"

2. Check if the port is accessible:
   ```bash
   psql "postgresql://postgres:postgres@localhost:5432/synthesis" -c "SELECT 1;"
   ```
   Should return `1` if working

3. Restart the database container:
   ```bash
   docker compose restart synthesis-db
   ```

### Issue 2: "password authentication failed for user 'postgres'"

**Problem:** You entered the wrong password

**Solution:** 
- Password is `postgres` (lowercase, same as username)
- Check your `docker-compose.yml` if you changed it

### Issue 3: "database 'synthesis' does not exist"

**Problem:** Database hasn't been created yet

**Solution:** Run migrations:
```bash
pnpm --filter @synthesis/db migrate
```

### Issue 4: Using wrong host on WSL2

**Problem:** Connection works from WSL2 terminal but not from Windows pgAdmin

**Solutions:**
- ✅ **From Windows pgAdmin:** Use `localhost` or `127.0.0.1`
- ✅ **From WSL2 pgAdmin:** Use `localhost`
- ❌ **Never use:** `synthesis-db` (that's the internal Docker network name)

---

## 🎯 Quick Connection Test

Before opening pgAdmin, verify the connection works from terminal:

```bash
# Test connection
psql "postgresql://postgres:postgres@localhost:5432/synthesis" -c "SELECT version();"

# List tables
psql "postgresql://postgres:postgres@localhost:5432/synthesis" -c "\dt"

# Check extensions
psql "postgresql://postgres:postgres@localhost:5432/synthesis" -c "\dx"
```

If these work, pgAdmin should also work with the same connection parameters.

---

## 📝 Useful SQL Queries for pgAdmin

Once connected, you can run these queries in the Query Tool:

### Check database size
```sql
SELECT pg_size_pretty(pg_database_size('synthesis'));
```

### Count records in each table
```sql
SELECT 
  'collections' as table_name, COUNT(*) as count FROM collections
UNION ALL
SELECT 
  'documents', COUNT(*) FROM documents
UNION ALL
SELECT 
  'chunks', COUNT(*) FROM chunks;
```

### View recent documents
```sql
SELECT 
  d.id,
  d.filename,
  d.mime_type,
  c.name as collection_name,
  d.created_at
FROM documents d
JOIN collections c ON d.collection_id = c.id
ORDER BY d.created_at DESC
LIMIT 10;
```

### Check vector embeddings
```sql
SELECT 
  d.filename,
  COUNT(ch.id) as chunk_count,
  COUNT(ch.embedding) as embeddings_count
FROM documents d
LEFT JOIN chunks ch ON d.id = ch.document_id
GROUP BY d.id, d.filename
ORDER BY chunk_count DESC;
```

### Monitor index usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## 🔐 Security Notes

### Development (Current Setup)
- **User:** `postgres` (superuser)
- **Password:** `postgres` (simple, public)
- **Port:** `5432` (exposed to localhost)
- ⚠️ **This is fine for local development**

### Production Recommendations
When deploying to production, change:

1. **Use a strong password:**
   ```bash
   POSTGRES_PASSWORD=<generate-strong-password>
   ```

2. **Create a dedicated user:**
   ```sql
   CREATE USER synthesis_app WITH PASSWORD 'strong_password_here';
   GRANT CONNECT ON DATABASE synthesis TO synthesis_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO synthesis_app;
   ```

3. **Don't expose port 5432** publicly (remove port mapping in docker-compose)

4. **Use environment variables:**
   ```bash
   DATABASE_URL=postgresql://synthesis_app:strong_pass@db:5432/synthesis
   ```

---

## 📚 Additional Resources

- **pgvector documentation:** https://github.com/pgvector/pgvector
- **PostgreSQL docs:** https://www.postgresql.org/docs/16/
- **Project database schema:** `docs/03_DATABASE_SCHEMA.md`
- **Environment setup:** `docs/10_ENV_SETUP.md`

---

## ✅ Verification Checklist

After setup, verify:

- [ ] pgAdmin connects successfully
- [ ] You can see all 4 tables (collections, documents, chunks, migrations)
- [ ] The `vector` extension (v0.6.0) is installed
- [ ] You can browse table data
- [ ] You can run SQL queries in the Query Tool

---

## 🆘 Still Having Issues?

1. **Check Docker logs:**
   ```bash
   docker compose logs synthesis-db
   ```

2. **Verify database health:**
   ```bash
   docker compose exec synthesis-db pg_isready -U postgres
   ```

3. **Connect via psql to test:**
   ```bash
   docker compose exec synthesis-db psql -U postgres -d synthesis
   ```

4. **Check if port 5432 is in use:**
   ```bash
   netstat -an | grep 5432
   # or
   ss -tulpn | grep 5432
   ```

If none of these work, the issue might be:
- Firewall blocking port 5432
- Another PostgreSQL instance using port 5432
- WSL2 networking issues (try restarting WSL2)

---

## 🎉 Success!

Once connected, you can:
- ✅ Browse your RAG collections and documents
- ✅ Inspect vector embeddings in the `chunks` table
- ✅ Run SQL queries for analytics
- ✅ Monitor database performance
- ✅ Debug issues with your RAG system

Happy querying! 🚀
