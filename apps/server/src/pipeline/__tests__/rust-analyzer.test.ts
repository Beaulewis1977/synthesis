/**
 * Rust Analyzer Tests (Phase 14)
 */

import { describe, expect, it } from 'vitest';
import { detectRustFrameworks, parseRustFile } from '../rust-analyzer.js';

describe('Rust Analyzer', () => {
  describe('parseRustFile', () => {
    it('should extract use statements', async () => {
      const code = `
use std::collections::HashMap;
use std::io::{self, Read, Write};
use crate::models::User;

fn main() {}
`;
      const ast = await parseRustFile(code, 'main.rs');
      expect(ast.imports).toHaveLength(3);
      expect(ast.imports[0].uri).toBe('std::collections::HashMap');
    });

    it('should extract functions', async () => {
      const code = `
fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn greet(name: &str) {
    println!("Hello, {}!", name);
}
`;
      const ast = await parseRustFile(code, 'lib.rs');
      expect(ast.functions).toHaveLength(2);
      expect(ast.functions[0].name).toBe('add');
      expect(ast.functions[0].returnType).toBe('i32');
      expect(ast.functions[1].name).toBe('greet');
    });

    it('should extract async functions', async () => {
      const code = `
async fn fetch_data(url: &str) -> Result<String, Error> {
    let response = reqwest::get(url).await?;
    Ok(response.text().await?)
}
`;
      const ast = await parseRustFile(code, 'lib.rs');
      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].isAsync).toBe(true);
    });

    it('should extract struct with fields', async () => {
      const code = `
#[derive(Debug, Clone)]
pub struct User {
    pub id: u64,
    pub name: String,
    email: String,
}
`;
      const ast = await parseRustFile(code, 'models.rs');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('User');
      expect(ast.classes[0].properties.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract struct with impl block methods', async () => {
      const code = `
struct Counter {
    count: i32,
}

impl Counter {
    pub fn new() -> Self {
        Counter { count: 0 }
    }
    
    pub fn increment(&mut self) {
        self.count += 1;
    }
    
    pub fn get(&self) -> i32 {
        self.count
    }
}
`;
      const ast = await parseRustFile(code, 'counter.rs');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].methods.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract trait', async () => {
      const code = `
pub trait Repository<T> {
    fn find_by_id(&self, id: u64) -> Option<T>;
    fn save(&mut self, item: T) -> Result<(), Error>;
}
`;
      const ast = await parseRustFile(code, 'traits.rs');
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('Repository');
      expect(ast.classes[0].isAbstract).toBe(true);
    });

    it('should extract enum', async () => {
      const code = `
#[derive(Debug)]
pub enum Status {
    Pending,
    Active,
    Completed,
}
`;
      const ast = await parseRustFile(code, 'status.rs');
      expect(ast.constants).toHaveLength(1);
      expect(ast.constants[0].name).toBe('Status');
      expect(ast.constants[0].type).toBe('enum');
    });

    it('should extract constants', async () => {
      const code = `
const MAX_RETRIES: u32 = 3;
pub static API_URL: &str = "https://api.example.com";
`;
      const ast = await parseRustFile(code, 'config.rs');
      expect(ast.constants.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('detectRustFrameworks', () => {
    it('should detect Actix-web framework', () => {
      const code = `
use actix_web::{web, App, HttpServer, Responder};

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().route("/", web::get().to(hello)))
        .bind("127.0.0.1:8080")?
        .run()
        .await
}
`;
      const frameworks = detectRustFrameworks(code, 'main.rs');
      expect(frameworks.length).toBeGreaterThan(0);
      expect(frameworks[0].name).toBe('actix');
      expect(frameworks[0].confidence).toBeGreaterThan(0.3);
    });

    it('should detect Tokio runtime', () => {
      const code = `
use tokio;

#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        println!("Hello from spawned task");
    });
    handle.await.unwrap();
}
`;
      const frameworks = detectRustFrameworks(code, 'main.rs');
      expect(frameworks.length).toBeGreaterThan(0);
      expect(frameworks[0].name).toBe('tokio');
    });

    it('should detect Redis usage', () => {
      const code = `
use redis::Commands;

fn main() {
    let client = redis::Client::open("redis://127.0.0.1/")?;
    let mut con = client.get_connection()?;
    con.set("key", "value")?;
}
`;
      const frameworks = detectRustFrameworks(code, 'main.rs');
      const redis = frameworks.find((f) => f.name === 'redis');
      expect(redis).toBeDefined();
    });

    it('should detect PostgreSQL usage', () => {
      const code = `
use tokio_postgres::{NoTls, Error};

async fn main() -> Result<(), Error> {
    let (client, connection) = tokio_postgres::connect("host=localhost", NoTls).await?;
    client.query("SELECT * FROM users", &[]).await?;
    Ok(())
}
`;
      const frameworks = detectRustFrameworks(code, 'main.rs');
      const postgres = frameworks.find((f) => f.name === 'postgres');
      expect(postgres).toBeDefined();
    });
  });
});
