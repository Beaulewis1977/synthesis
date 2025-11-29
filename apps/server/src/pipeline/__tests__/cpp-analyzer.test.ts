/**
 * C/C++ Analyzer Tests (Phase 14)
 */

import { describe, expect, it } from 'vitest';
import { parseCFile, parseCppFile } from '../cpp-analyzer.js';

describe('C++ Analyzer', () => {
  describe('parseCppFile', () => {
    it('should extract includes', async () => {
      const code = `
#include <iostream>
#include <vector>
#include "myheader.h"

int main() {
    return 0;
}
`;
      const ast = await parseCppFile(code, 'main.cpp');
      expect(ast.imports).toHaveLength(3);
      expect(ast.imports[0].uri).toBe('iostream');
      expect(ast.imports[1].uri).toBe('vector');
      expect(ast.imports[2].uri).toBe('myheader.h');
    });

    it('should extract functions', async () => {
      const code = `
int add(int a, int b) {
    return a + b;
}

void greet(const std::string& name) {
    std::cout << "Hello, " << name << std::endl;
}
`;
      const ast = await parseCppFile(code, 'utils.cpp');
      expect(ast.functions).toHaveLength(2);
      expect(ast.functions[0].name).toBe('add');
      expect(ast.functions[0].returnType).toBe('int');
      expect(ast.functions[1].name).toBe('greet');
    });

    it('should extract class with methods', async () => {
      const code = `
class Calculator {
public:
    int add(int a, int b) {
        return a + b;
    }
    
    int subtract(int a, int b) {
        return a - b;
    }
    
private:
    int result;
};
`;
      const ast = await parseCppFile(code, 'calculator.cpp');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Calculator');
      expect(ast.classes[0].methods.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract class with inheritance', async () => {
      const code = `
class Dog : public Animal {
public:
    void bark() {
        std::cout << "Woof!" << std::endl;
    }
};
`;
      const ast = await parseCppFile(code, 'dog.cpp');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Dog');
      expect(ast.classes[0].superclass).toBe('Animal');
    });

    it('should extract struct', async () => {
      const code = `
struct Point {
    double x;
    double y;
    double z;
};
`;
      const ast = await parseCppFile(code, 'point.cpp');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Point');
      expect(ast.classes[0].properties.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract enum', async () => {
      const code = `
enum class Color {
    Red,
    Green,
    Blue
};
`;
      const ast = await parseCppFile(code, 'color.cpp');
      expect(ast.constants).toHaveLength(1);
      expect(ast.constants[0].name).toBe('Color');
      expect(ast.constants[0].type).toBe('enum');
    });

    it('should extract constants', async () => {
      const code = `
#define MAX_SIZE 100
const int MAX_RETRIES = 3;
constexpr double PI = 3.14159;
`;
      const ast = await parseCppFile(code, 'constants.cpp');
      expect(ast.constants.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle template class', async () => {
      const code = `
template<typename T>
class Container {
public:
    void add(T item) {
        items.push_back(item);
    }
    
    T get(int index) {
        return items[index];
    }
    
private:
    std::vector<T> items;
};
`;
      const ast = await parseCppFile(code, 'container.cpp');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Container');
    });
  });

  describe('parseCFile', () => {
    it('should extract C functions', async () => {
      const code = `
#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

void print_hello() {
    printf("Hello, World!\\n");
}
`;
      const ast = await parseCFile(code, 'utils.c');
      expect(ast.imports).toHaveLength(1);
      expect(ast.functions).toHaveLength(2);
    });

    it('should extract C struct', async () => {
      const code = `
struct Person {
    char name[50];
    int age;
    float height;
};
`;
      const ast = await parseCFile(code, 'person.c');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Person');
    });

    it('should extract C macros', async () => {
      const code = `
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define PI 3.14159
#define BUFFER_SIZE 1024
`;
      const ast = await parseCFile(code, 'macros.c');
      expect(ast.constants.length).toBeGreaterThanOrEqual(2);
    });
  });
});
