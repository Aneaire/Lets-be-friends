import { Account, Client, Databases, Storage } from "appwrite";

export const config = {
  projectId: process.env.VITE_PROJECT_ID!,
  url: process.env.VITE_URL!,
  mainDb: process.env.VITE_MAIN_DATABASE_ID!,

  // Users
  userCollection: process.env.VITE_USER_COLLECTION_ID!,
  friendListCollection: process.env.VITE_FRIEND_LIST_COLLECTION_ID!,
  userSupportCollection: process.env.VITE_USER_SUPPORT_COLLECTION_ID!,

  // Posts
  postCollection: process.env.VITE_POST_COLLECTION_ID!,
  userLikesCollection: process.env.VITE_USER_LIKES_COLLECTION_ID!,
  userSavedCollection: process.env.VITE_USER_SAVED_COLLECTION_ID!,

  // Buckets
  postBucket: process.env.VITE_POST_BUCKET_ID!,
};

export const client = new Client();

client.setEndpoint(config.url).setProject(config.projectId);

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);
