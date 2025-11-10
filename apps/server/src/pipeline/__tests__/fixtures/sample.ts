/* biome-ignore */
import * as fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
const http = require('node:http');

// Top-level constant
export const API_VERSION = 'v1';

// Enum
export enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
  Guest = 'GUEST',
}

/**
 * Initialize the application
 * Sets up middleware and routes
 */
export async function initializeApp(): Promise<void> {
  console.log('Initializing app...');
  await setupDatabase();
  await loadConfig();
}

// Arrow function
const setupDatabase = async (): Promise<void> => {
  console.log('Setting up database...');
};

// Arrow function with explicit return type
export const loadConfig = async (): Promise<{ port: number; host: string }> => {
  return {
    port: 3000,
    host: 'localhost',
  };
};

// Regular function with parameters
function validateUser(username: string, password: string): boolean {
  if (!username || !password) {
    return false;
  }
  return username.length > 3 && password.length > 8;
}

// Generator function
function* fibonacci(n: number): Generator<number, void, unknown> {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// Abstract class
abstract class BaseService {
  protected readonly serviceName: string;

  constructor(name: string) {
    this.serviceName = name;
  }

  abstract connect(): Promise<void>;

  protected log(message: string): void {
    console.log(`[${this.serviceName}] ${message}`);
  }
}

// Concrete class with inheritance
export class DatabaseService extends BaseService implements IService {
  private static instance: DatabaseService;
  private connected = false;
  public readonly connectionString: string;

  private constructor(connectionString: string) {
    super('DatabaseService');
    this.connectionString = connectionString;
  }

  static getInstance(connectionString: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(connectionString);
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    this.log('Connecting to database...');
    this.connected = true;
  }

  disconnect = (): void => {
    this.log('Disconnecting from database...');
    this.connected = false;
  };

  get isConnected(): boolean {
    return this.connected;
  }

  set connectionStatus(status: boolean) {
    this.connected = status;
  }
}

// Interface (won't be extracted by parser, but referenced)
interface IService {
  connect(): Promise<void>;
}

// Type alias (won't be extracted by parser, but for completeness)
type UserData = {
  id: number;
  name: string;
  role: UserRole;
};

// Complex arrow function with object destructuring
export const processUser = async ({ id, name, role }: UserData): Promise<void> => {
  console.log(`Processing user ${name} with role ${role}`);
};

// Nested function (should be skipped by parser)
function outerFunction() {
  function innerFunction() {
    console.log('This is nested');
  }
  return innerFunction;
}
