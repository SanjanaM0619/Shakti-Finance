import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer = null;
let connectionMode = 'disconnected';

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return { uri: mongoose.connection.host, mode: connectionMode };
  }

  const configuredUri = process.env.MONGODB_URI;

  if (configuredUri) {
    await mongoose.connect(configuredUri, {
      serverSelectionTimeoutMS: 5000,
    });
    connectionMode = 'external-mongodb';
    console.log(`Connected to MongoDB (${connectionMode})`);
    return { uri: configuredUri, mode: connectionMode };
  }

  // Automatic zero-config embedded MongoDB for local development & automated tests
  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: 'shakti_finance' },
  });
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  connectionMode = 'embedded-mongodb';
  if (process.env.NODE_ENV !== 'test') {
    console.log(
      `Connected to embedded MongoDB (${memUri}). Set MONGODB_URI in backend/.env for persistent MongoDB Atlas/local cluster.`
    );
  }
  return { uri: memUri, mode: connectionMode };
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  connectionMode = 'disconnected';
}

export function getDatabaseStatus() {
  return {
    readyState: mongoose.connection.readyState,
    mode: connectionMode,
  };
}
