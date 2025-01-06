import { Account, Client, Databases, Functions, Storage } from "appwrite";

export const config = {
  projectId: process.env.VITE_PROJECT_ID!,
  url: process.env.VITE_URL!,
  mainDb: process.env.VITE_MAIN_DATABASE_ID!,
  chatDb: process.env.VITE_CHAT_DATABASE_ID!,

  // Users
  userCollection: process.env.VITE_USER_COLLECTION_ID!,
  friendListCollection: process.env.VITE_FRIEND_LIST_COLLECTION_ID!,
  userSupportCollection: process.env.VITE_USER_SUPPORT_COLLECTION_ID!,

  // Booking
  bookingCollection: process.env.VITE_BOOKING_COLLECTION_ID!,
  receiptCollection: process.env.VITE_RECEIPT_COLLECTION_ID!,

  // Posts
  postCollection: process.env.VITE_POST_COLLECTION_ID!,
  userLikesCollection: process.env.VITE_USER_LIKES_COLLECTION_ID!,
  userSavedCollection: process.env.VITE_USER_SAVED_COLLECTION_ID!,

  // Conversations
  conversationCollection: process.env.VITE_CONVERSATION_COLLECTION_ID!,

  // Functions
  createConversationFnId: process.env.VITE_CREATE_CONVERSATION_ID!,
  manageConversationFnId: process.env.VITE_MANAGE_CONVERSATION_ID!,
  paymongoFnId: process.env.VITE_PAYMONGO_FUNCTION_ID!,

  // Buckets
  postBucket: process.env.VITE_POST_BUCKET_ID!,
  bookingBucket: process.env.VITE_BOOKING_BUCKET_ID!,
};

export const client = new Client();

client.setEndpoint(config.url).setProject(config.projectId);

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
