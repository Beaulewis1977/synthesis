/* biome-ignore */
import { EventEmitter } from 'events';
import path from 'node:path';

// Named import
export class DataStore extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.data = new Map();
  }

  set(key, value) {
    this.data.set(key, value);
    this.emit('change', { key, value });
    return this;
  }

  get(key) {
    return this.data.get(key);
  }

  static create(name) {
    return new DataStore(name);
  }
}

// Regular function
export function processData(input) {
  if (!input) {
    throw new Error('Input required');
  }
  return input.trim().toUpperCase();
}

// Arrow function with default export
const formatPath = (filePath) => {
  return path.normalize(filePath);
};

export default formatPath;

// Async function
export async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}
