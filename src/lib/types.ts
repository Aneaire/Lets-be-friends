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
  email: string;
  verified?: boolean;
  posts?: IPost[]; // Assuming the relatedCollection is represented as a string ID
  likedPosts: IUserLikes[];
} & Models.Document;

export type ICreatePost = {
  userId: string;
  caption: string;
  file: File[];
  location?: string;
  tags?: string;
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
