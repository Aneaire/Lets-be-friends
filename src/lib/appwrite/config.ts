import { Client, Databases, Storage } from "appwrite";

export const config = {
  projectId: process.env.VITE_PROJECT_ID!,
  url: process.env.VITE_URL!,
  mainDb: process.env.VITE_MAIN_DATABASE_ID!,
};

export const client = new Client();

client.setEndpoint(config.url).setProject(config.projectId);

export const databases = new Databases(client);
export const storage = new Storage(client);
