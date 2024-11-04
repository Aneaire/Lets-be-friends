import useAuthStore from "@/store/userStore";
import { defaultToast } from "@/utils/defaultToast";
import { ID, Query } from "appwrite";
import { toast } from "sonner";
import { globalConfig } from "../globalConfig";
import {
  ICreateAccount,
  ICreatePost,
  IPost,
  ISavedPost,
  IUpdatePost,
  IUser,
  IUserLikes,
} from "../types";
import { deleteFile, getFilePreview, uploadFile } from "./buckets";
import { account, config, databases, storage } from "./config";
import { userAccess, userToAny } from "./permissions";

// Handling accounts
export const signIn = async (email: string, password: string) => {
  const signInAccountFromStore = useAuthStore.getState().login;
  try {
    const accountSignedIn = await account.createEmailPasswordSession(
      email,
      password
    );

    if (!accountSignedIn) {
      throw new Error("Failed to sign in");
    }

    const user: IUser | undefined = await getOwnerInfos();

    if (!user) {
      throw new Error("Failed to get user");
    }

    signInAccountFromStore({
      id: user.$id,
      accountId: user.accountId,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      imageId: user.imageId,
      image: user.image,
    });

    return accountSignedIn;
  } catch (error: any) {
    if (error.message.includes("Invalid credentials.")) {
      toast.error(error.message);
    }
  }
};

export async function signOutAccount() {
  const logoutfromStore = useAuthStore.getState().logout;
  try {
    const session = account.deleteSession("current");

    logoutfromStore();
    return session;
  } catch (error) {
    toast.error("Something went wrong");
  }
}

export const createAccount = async ({
  email,
  password,
  fullName,
  username,
}: ICreateAccount) => {
  try {
    const accountCreated = await account.create(
      ID.unique(),
      email,
      password,
      fullName
    );

    if (!accountCreated) {
      throw new Error("Failed to create account");
    }

    await signIn(email, password).then(() => {
      if (globalConfig.appUrl === "") {
        console.log("domain is not set on environment variables");
        return;
      }
      storeAccountToUser({
        accountId: accountCreated.$id,
        email,
        fullName,
        username,
      });
    });

    return accountCreated;
  } catch (error) {
    console.error(error);
  }
};

export const verifyAccount = async ({
  accountId,
  secret,
}: {
  accountId: string;
  secret: string;
}) => {
  try {
    const promise = account.updateVerification(accountId, secret);

    if (!promise) {
      throw new Error("Something went wrong");
    }

    console.log(promise);

    return promise;
  } catch (error) {
    console.error(error);
  }
};

export const storeAccountToUser = async ({
  accountId,
  email,
  fullName,
  username,
}: {
  accountId: string;
  email: string;
  fullName: string;
  username: string;
}) => {
  try {
    const signInAccountFromStore = useAuthStore.getState().login;
    const user: IUser = await databases.createDocument(
      config.mainDb,
      config.userCollection,
      ID.unique(),
      {
        accountId,
        fullName,
        username,
        email,
      },
      userAccess(accountId)
    );
    if (!user) {
      throw new Error("Failed to store account to user");
    }

    signInAccountFromStore({
      id: user.$id,
      accountId: user.accountId,
      image: user.image,
      imageId: user.imageId,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
    });

    return user;
  } catch (error) {
    console.log(error);
  }
};

export const getOwnerInfos = async () => {
  try {
    const acc = await account.get();

    if (!acc) {
      throw new Error("Failed to get account");
    }

    const user = await databases.listDocuments(
      config.mainDb,
      config.userCollection,
      [
        Query.search("accountId", acc.$id),
        Query.select(["$id", "$createdAt", "*"]),
      ]
    );

    return user.documents[0] as IUser;
  } catch (error) {
    console.error(error);
  }
};

// Images

export const getPostImage = async ({
  imageId,
  quality,
}: {
  imageId: string;
  quality: number;
}) => {
  try {
    const image = await storage.getFilePreview(
      config.postBucket,
      imageId,
      undefined, // width
      undefined, // height
      undefined, // gravity
      quality // quality
    );

    if (!image) {
      throw new Error("Failed to get image");
    }

    return image;
  } catch (error) {
    console.error(error);
  }
};

// Post

export async function getPost({ id }: { id: string }) {
  try {
    const post = await databases.getDocument(
      config.mainDb,
      config.postCollection,
      id
    );

    if (!post) {
      throw new Error("Failed to get post");
    }

    return post as IPost;
  } catch (error) {
    console.error(error);
  }
}

export async function getRecentInfinitePosts({
  pageParam,
}: {
  pageParam: number;
}) {
  const queries: any[] = [
    Query.orderDesc("$createdAt"),
    Query.limit(10),
    Query.isNotNull("creator"),
    Query.select(["$createdAt", "$id", "*", "creator.*"]),
  ];

  if (pageParam) {
    queries.push(Query.cursorAfter(pageParam.toString()));
  }

  try {
    const posts = await databases.listDocuments(
      config.mainDb,
      config.postCollection,
      queries
    );

    if (!posts) throw Error;

    return posts;
  } catch (error) {
    console.error(error);
  }
}

export async function createPost(post: ICreatePost) {
  try {
    let fileUrl;

    // Upload file to appwrite storage
    if (post.file.length > 0) {
      const uploadedFile = await uploadFile(post.file[0]);

      if (!uploadedFile) throw Error;

      // Get file url
      const getFileUrl = getFilePreview(uploadedFile.$id);
      if (!getFileUrl) {
        await deleteFile(uploadedFile.$id);
        throw Error;
      }
      fileUrl = { fileUrl: getFileUrl, id: uploadedFile.$id };
    }

    // Convert tags into array
    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    // Create post
    const newPost = await databases.createDocument(
      config.mainDb,
      config.postCollection,
      ID.unique(),
      {
        creator: post.userId,
        creatorId: post.userId,
        caption: post.caption,
        image: post.file.length == 0 ? null : fileUrl?.fileUrl,
        imageId: post.file.length == 0 ? null : fileUrl?.id,
        location: post.location,
        tags: tags,
        likes: 0,
      },
      userToAny(post.accountId)
    );

    if (!newPost && fileUrl) {
      await deleteFile(fileUrl?.id);
      throw Error;
    }

    return newPost;
  } catch (error) {
    toast.error("Something went wrong");
  }
}

export async function updatePost(post: IUpdatePost) {
  const hasFileToUpdate = post.file.length > 0;

  try {
    let image: any = {
      imageUrl: post.imageUrl,
      imageId: post.imageId,
    };
    // Upload file to appwrite storage
    if (hasFileToUpdate) {
      if (post.imageId) await deleteFile(post.imageId);
      const uploadedFile = await uploadFile(post.file[0]);
      if (!uploadedFile) throw Error;

      // Get file url
      const fileUrl = getFilePreview(uploadedFile.$id);
      if (!fileUrl) {
        await deleteFile(uploadedFile.$id);
        throw Error;
      }
      image = { ...image, imageUrl: fileUrl, imageId: uploadedFile.$id };
    }

    // Convert tags into array
    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    // Create post
    const newPost = await databases.updateDocument(
      config.mainDb,
      config.postCollection,
      post.postId,
      {
        caption: post.caption,
        image: image.image,
        imageId: image.imageId,
        location: post.location,
        tags: tags,
      }
    );

    if (!newPost && post.imageId) {
      await deleteFile(post.imageId);
      throw Error;
    }

    return newPost;
  } catch (error) {
    defaultToast.SWW;
  }
}

export async function deletePost({
  postId,
  imageId,
}: {
  postId?: string;
  imageId: string;
}) {
  if (!postId) throw Error;

  try {
    if (imageId) await deleteFile(imageId);

    await databases.deleteDocument(
      config.mainDb,
      config.postCollection,
      postId
    );

    return { status: "ok" };
  } catch (error) {
    defaultToast.SWW;
  }
}

export async function createCaptionPost({
  caption,
  creator,
}: {
  caption: string;
  creator: string;
}) {
  try {
    const { user } = useAuthStore.getState();
    const newPost = await databases.createDocument(
      config.mainDb,
      config.postCollection,
      ID.unique(),
      {
        creator: creator,
        creatorId: creator,
        caption: caption,
      },
      userToAny(user.accountId)
    );

    if (!newPost) throw Error;

    return newPost;
  } catch (error) {
    toast.error("Something went wrong");
  }
}

export async function checkLiked({ postId }: { postId: string }) {
  const { user } = useAuthStore.getState();
  try {
    const updatedPost = await databases.listDocuments(
      config.mainDb,
      config.userLikesCollection,
      [Query.equal("userId", user.id), Query.equal("postId", postId)]
    );

    if (updatedPost.documents.length === 0) return null;

    return updatedPost.documents[0];
  } catch (error) {
    console.error(error);
  }
}

export async function likePost({ postId }: { postId: string }) {
  const { user } = useAuthStore.getState();
  try {
    const updatedPost = await databases.createDocument(
      config.mainDb,
      config.userLikesCollection,
      ID.unique(),
      {
        postId,
        userId: user.id,
        post: postId,
        user: user.id,
      } as IUserLikes,
      userToAny(user.accountId)
    );

    if (!updatedPost) throw Error;

    return updatedPost;
  } catch (error) {
    console.error(error);
  }
}

export async function unlikePost({ userLikesId }: { userLikesId: string }) {
  try {
    const deleteLike = await databases.deleteDocument(
      config.mainDb,
      config.userLikesCollection,
      userLikesId
    );

    if (!deleteLike) throw Error;

    return deleteLike;
  } catch (error) {
    console.error(error);
  }
}

export async function checkSaved({ postId }: { postId: string }) {
  const { user } = useAuthStore.getState();
  try {
    const updatedPost = await databases.listDocuments(
      config.mainDb,
      config.userSavedCollection,
      [Query.equal("userId", user.id), Query.equal("postId", postId)]
    );

    if (!updatedPost) throw Error;

    return updatedPost.documents[0];
  } catch (error) {
    console.error(error);
  }
}

export async function savePost({ postId }: { postId: string }) {
  const { user } = useAuthStore.getState();
  try {
    const checkIfSavedAlready = await checkSaved({ postId });

    if (checkIfSavedAlready) {
      toast("Post already saved");
      return checkIfSavedAlready;
    }

    const updatedPost = await databases.createDocument(
      config.mainDb,
      config.userSavedCollection,
      ID.unique(),
      {
        postId,
        userId: user.id,
        post: postId,
      } as ISavedPost,
      userAccess(user.accountId)
    );

    if (!updatedPost) throw Error;

    toast.success("Post saved");
    return updatedPost;
  } catch (error) {
    console.error(error);
  }
}

export const unSavePost = async ({ userSavedId }: { userSavedId: string }) => {
  try {
    const deleteSaved = await databases.deleteDocument(
      config.mainDb,
      config.userSavedCollection,
      userSavedId
    );

    if (!deleteSaved) throw Error;

    return deleteSaved;
  } catch (error) {
    console.error(error);
  }
};
