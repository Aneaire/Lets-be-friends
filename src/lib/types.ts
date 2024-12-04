import { Models } from "appwrite";

export type ICreateAccount = {
  email: string;
  password: string;
  fullName: string;
  username: string;
};

export type IUser = {
  accountId: string;
  fullName: string;
  username: string;
  imageId: string;
  image: string;
  email: string;
  verified?: boolean;
  posts?: IPost[]; // Assuming the relatedCollection is represented as a string ID
  likedPosts: IUserLikes[];
  support: ISupport | string;
} & Models.Document;

export type ISupport = {
  userId: string;
  list: string[];
  user: IUser;
  price: number;
} & Models.Document;

export type IBooking = {
  bookerId: string;
  ownerId: string;
  date: Date;
  price: number;
  status: "pending" | "accepted" | "rejected";
  ownerAccepted: boolean;
} & Models.Document;

export type IConversation = {
  conversationId: string;
  userIds: string;
  read: boolean;
  preview: string;
} & Models.Document;

export type IMessage = {
  body: string;
  read: boolean;
  type: "text" | "image";
  sender: string;
  imageUrl?: string;
  imageId?: string;
} & Models.Document;

export type IUserImageAndName = {
  fullName: string;
  username: string;
  imageId: string;
};
export type ICreatePost = {
  userId: string;
  caption: string;
  file: File[];
  location?: string;
  tags?: string;
  usedDp?: boolean;
  accountId: string;
};

export type IUpdatePost = {
  postId: string;
  caption: string;
  imageId?: string;
  imageUrl?: URL;
  usedDp?: boolean;
  file: File[];
  location?: string;
  tags?: string;
};

export type IDeletePost = {
  postId: string;
  imageId: string;
  image?: URL;
};

export type IPost = {
  caption?: string;
  image?: string;
  creatorId: string;
  tags: string[];
  imageId?: string;
  creator: IUser; // Assuming the relatedCollection is represented as a string ID
  likes: number;
  location?: string;
  userlikes: IUserLikes[]; // Assuming the relatedCollection is represented as a string ID
} & Models.Document;

export type IUserLikes = {
  postId: string;
  userId: string;
  post?: IPost[] | string;
  user: IUser | string;
} & Models.Document;

export type ISavedPost = {
  postId: string;
  userId: string;
  post: IPost | string;
};
