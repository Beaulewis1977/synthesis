/**
 * Go Analyzer Tests (Phase 14)
 */

import { describe, expect, it } from 'vitest';
import { detectGoFrameworks, parseGoFile } from '../go-analyzer.js';

describe('Go Analyzer', () => {
  describe('parseGoFile', () => {
    it('should extract single import', async () => {
      const code = `
package main

import "fmt"

func main() {
    fmt.Println("Hello")
}
`;
      const ast = await parseGoFile(code, 'main.go');
      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0].uri).toBe('fmt');
    });

    it('should extract import block', async () => {
      const code = `
package main

import (
    "fmt"
    "net/http"
    json "encoding/json"
)

func main() {}
`;
      const ast = await parseGoFile(code, 'main.go');
      expect(ast.imports).toHaveLength(3);
      expect(ast.imports[0].uri).toBe('fmt');
      expect(ast.imports[1].uri).toBe('net/http');
      expect(ast.imports[2].uri).toBe('encoding/json');
      expect(ast.imports[2].prefix).toBe('json');
    });

    it('should extract functions', async () => {
      const code = `
package main

func add(a int, b int) int {
    return a + b
}

func greet(name string) {
    fmt.Println("Hello", name)
}
`;
      const ast = await parseGoFile(code, 'main.go');
      expect(ast.functions).toHaveLength(2);
      expect(ast.functions[0].name).toBe('add');
      expect(ast.functions[0].returnType).toBe('int');
      expect(ast.functions[1].name).toBe('greet');
    });

    it('should extract function with multiple return values', async () => {
      const code = `
package main

func divide(a, b int) (int, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}
`;
      const ast = await parseGoFile(code, 'main.go');
      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].returnType).toContain('int');
      expect(ast.functions[0].returnType).toContain('error');
    });

    it('should extract struct', async () => {
      const code = `
package main

type User struct {
    ID        int
    Name      string
    Email     string
    CreatedAt time.Time
}
`;
      const ast = await parseGoFile(code, 'main.go');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('User');
      expect(ast.classes[0].properties.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract interface', async () => {
      const code = `
package main

type Repository interface {
    FindById(id int) (*User, error)
    Save(user *User) error
}
`;
      const ast = await parseGoFile(code, 'main.go');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Repository');
      expect(ast.classes[0].isAbstract).toBe(true);
    });

    it('should extract constants', async () => {
      const code = `
package main

const MaxRetries = 3

const (
    StatusPending = "pending"
    StatusActive = "active"
)
`;
      const ast = await parseGoFile(code, 'main.go');
      expect(ast.constants.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('detectGoFrameworks', () => {
    it('should detect Gin framework', () => {
      const code = `
package main

import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()
    r.GET("/ping", func(c *gin.Context) {
        c.JSON(200, gin.H{"message": "pong"})
    })
    r.Run()
}
`;
      const frameworks = detectGoFrameworks(code, 'main.go');
      expect(frameworks.length).toBeGreaterThan(0);
      const gin = frameworks.find((f) => f.name === 'gin');
      expect(gin).toBeDefined();
      expect(gin?.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it('should detect Echo framework', () => {
      const code = `
package main

import "github.com/labstack/echo/v4"

func main() {
    e := echo.New()
    e.GET("/", hello)
    e.Logger.Fatal(e.Start(":1323"))
}
`;
      const frameworks = detectGoFrameworks(code, 'main.go');
      expect(frameworks.length).toBeGreaterThan(0);
      const echo = frameworks.find((f) => f.name === 'echo');
      expect(echo).toBeDefined();
    });

    it('should detect Redis usage', () => {
      const code = `
package main

import "github.com/go-redis/redis/v8"

func main() {
    rdb := redis.NewClient(&redis.Options{
        Addr: "localhost:6379",
    })
    rdb.Set(ctx, "key", "value", 0)
}
`;
      const frameworks = detectGoFrameworks(code, 'main.go');
      const redis = frameworks.find((f) => f.name === 'redis');
      expect(redis).toBeDefined();
    });

    it('should detect PostgreSQL usage', () => {
      const code = `
package main

import "github.com/jackc/pgx/v4"

func main() {
    conn, _ := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
    conn.Query(ctx, "SELECT * FROM users")
}
`;
      const frameworks = detectGoFrameworks(code, 'main.go');
      const postgres = frameworks.find((f) => f.name === 'postgres');
      expect(postgres).toBeDefined();
    });
  });
});
