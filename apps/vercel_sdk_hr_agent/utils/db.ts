import { MongoClient } from 'mongodb';
import { Employee, Team, Project } from './types';

// Cache the MongoDB client connection to reuse it across requests
let cachedClient: MongoClient | null = null;
let cachedClientPromise: Promise<MongoClient> | null = null;

if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const MONGODB_URI = process.env.MONGODB_URI;

export async function connectToDatabase() {
  if (cachedClient && cachedClientPromise) {
    return { client: cachedClient, clientPromise: cachedClientPromise };
  }

  cachedClient = new MongoClient(MONGODB_URI);
  cachedClientPromise = cachedClient.connect();

  return { client: cachedClient, clientPromise: cachedClientPromise };
}

export async function getCollections() {
  const { client } = await connectToDatabase();
  const db = client.db('hr_database');

  return {
    client,
    employees: db.collection<Employee>('employees'),
    teams: db.collection<Team>('teams'),
    projects: db.collection<Project>('projects')
  };
}
