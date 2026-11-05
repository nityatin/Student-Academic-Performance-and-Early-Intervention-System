import { MongoClient, Db } from "mongodb";

const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
  }
  return new MongoClient(uri).connect();
}

const clientPromise = globalForMongo.mongoClient ?? connect();

if (process.env.NODE_ENV !== "production") globalForMongo.mongoClient = clientPromise;

export async function getMongoDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "sapeis");
}
