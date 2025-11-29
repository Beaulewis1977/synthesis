/**
 * Java Analyzer Tests (Phase 14)
 */

import { describe, expect, it } from 'vitest';
import { detectJavaFrameworks, parseJavaFile } from '../java-analyzer.js';

describe('Java Analyzer', () => {
  describe('parseJavaFile', () => {
    it('should extract imports', async () => {
      const code = `
import java.util.List;
import java.util.ArrayList;
import static java.lang.Math.PI;

public class Test {}
`;
      const ast = await parseJavaFile(code, 'Test.java');
      expect(ast.imports).toHaveLength(3);
      expect(ast.imports[0].uri).toBe('java.util.List');
      expect(ast.imports[1].uri).toBe('java.util.ArrayList');
      expect(ast.imports[2].uri).toBe('java.lang.Math.PI');
    });

    it('should extract class with methods', async () => {
      const code = `
public class UserService {
    private String name;
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
}
`;
      const ast = await parseJavaFile(code, 'UserService.java');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('UserService');
      expect(ast.classes[0].methods).toHaveLength(2);
      expect(ast.classes[0].methods[0].name).toBe('getName');
      expect(ast.classes[0].methods[1].name).toBe('setName');
      expect(ast.classes[0].properties).toHaveLength(1);
      expect(ast.classes[0].properties[0].name).toBe('name');
    });

    it('should extract class with inheritance', async () => {
      const code = `
public class Dog extends Animal implements Runnable, Comparable<Dog> {
    public void run() {}
}
`;
      const ast = await parseJavaFile(code, 'Dog.java');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Dog');
      expect(ast.classes[0].superclass).toBe('Animal');
      expect(ast.classes[0].interfaces).toContain('Runnable');
      expect(ast.classes[0].interfaces).toContain('Comparable');
    });

    it('should extract abstract class', async () => {
      const code = `
public abstract class Shape {
    public abstract double area();
}
`;
      const ast = await parseJavaFile(code, 'Shape.java');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].isAbstract).toBe(true);
    });

    it('should extract interface', async () => {
      const code = `
public interface Repository<T> extends CrudRepository<T> {
    T findById(Long id);
}
`;
      const ast = await parseJavaFile(code, 'Repository.java');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Repository');
      expect(ast.classes[0].isAbstract).toBe(true);
    });

    it('should extract enum', async () => {
      const code = `
public enum Status {
    PENDING,
    ACTIVE,
    COMPLETED
}
`;
      const ast = await parseJavaFile(code, 'Status.java');
      expect(ast.constants).toHaveLength(1);
      expect(ast.constants[0].name).toBe('Status');
      expect(ast.constants[0].type).toBe('enum');
    });

    it('should extract static final constants', async () => {
      const code = `
public class Constants {
    public static final String API_URL = "https://api.example.com";
    public static final int MAX_RETRIES = 3;
}
`;
      const ast = await parseJavaFile(code, 'Constants.java');
      expect(ast.constants.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle annotations', async () => {
      const code = `
@RestController
@RequestMapping("/api")
public class UserController {
    
    @GetMapping("/users")
    public List<User> getUsers() {
        return userService.findAll();
    }
    
    @PostMapping("/users")
    public User createUser(@RequestBody User user) {
        return userService.save(user);
    }
}
`;
      const ast = await parseJavaFile(code, 'UserController.java');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].methods).toHaveLength(2);
    });
  });

  describe('detectJavaFrameworks', () => {
    it('should detect Spring framework', () => {
      const code = `
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
public class HelloController {
    @GetMapping("/hello")
    public String hello() {
        return "Hello World";
    }
}
`;
      const frameworks = detectJavaFrameworks(code, 'HelloController.java');
      expect(frameworks.length).toBeGreaterThan(0);
      expect(frameworks[0].name).toBe('spring');
      expect(frameworks[0].confidence).toBeGreaterThan(0.3);
    });

    it('should detect Android framework', () => {
      const code = `
import android.app.Activity;
import android.os.Bundle;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
    }
}
`;
      const frameworks = detectJavaFrameworks(code, 'MainActivity.java');
      expect(frameworks.length).toBeGreaterThan(0);
      expect(frameworks[0].name).toBe('android');
      expect(frameworks[0].confidence).toBeGreaterThan(0.3);
    });

    it('should detect Redis usage', () => {
      const code = `
import redis.clients.jedis.Jedis;

public class CacheService {
    private Jedis jedis = new Jedis("localhost");
    
    public void set(String key, String value) {
        jedis.set(key, value);
    }
}
`;
      const frameworks = detectJavaFrameworks(code, 'CacheService.java');
      const redis = frameworks.find((f) => f.name === 'redis');
      expect(redis).toBeDefined();
    });

    it('should detect PostgreSQL usage', () => {
      const code = `
import java.sql.Connection;
import java.sql.DriverManager;

public class DatabaseService {
    public Connection connect() {
        return DriverManager.getConnection("jdbc:postgresql://localhost/mydb");
    }
}
`;
      const frameworks = detectJavaFrameworks(code, 'DatabaseService.java');
      const postgres = frameworks.find((f) => f.name === 'postgres');
      expect(postgres).toBeDefined();
    });
  });
});
