import useAuthStore from "@/store/userStore";
import { defaultToast } from "@/utils/defaultToast";
import { ID, Query } from "appwrite";
import { toast } from "sonner";
import { globalConfig } from "../globalConfig";
import {
  IBooking,
  ICreateAccount,
  ICreatePost,
  IMessage,
  IPost,
  ISavedPost,
  ISupport,
  IUpdatePost,
  IUser,
  IUserLikes,
} from "../types";
import { deleteFile, getFilePreview, uploadFile } from "./buckets";
import { account, config, databases, storage } from "./config";
import { updateConversation } from "./functions";
import { userAccess, userToAny, userToAnyUpdate } from "./permissions";

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

export const updateOwnerInfos = async ({
  bio,
  bday,
  gender,
  userId,
}: { userId: string } & Pick<IUser, "bio" | "bday" | "gender">) => {
  try {
    const infos = await databases.updateDocument(
      config.mainDb,
      config.userCollection,
      userId,
      {
        bio: bio,
        gender: gender,
        bday: bday,
      }
    );

    if (!infos) {
      throw new Error("Failed to update infos");
    }

    return infos;
  } catch (error) {
    console.error(error);
  }
};

export const getOwnerInfosAndSupport = async () => {
  try {
    const acc = useAuthStore.getState().user;

    if (!acc) {
      throw new Error("Failed to get account");
    }

    const user = await databases.getDocument(
      config.mainDb,
      config.userCollection,
      acc.id,
      [Query.select(["$id", "*"])]
    );

    if (user.support) {
      const support = await getSupport(user.support);

      user.support = support;
    }

    return user as IUser;
  } catch (error) {
    console.error(error);
  }
};

export const getSupport = async (id: string) => {
  try {
    const support = await databases.getDocument(
      config.mainDb,
      config.userSupportCollection,
      id,
      [Query.select(["$id", "*", "user.accountId"])]
    );

    return support as ISupport;
  } catch (error) {
    console.error(error);
  }
};

export const getSupportByUserId = async (id: string) => {
  try {
    const support = await databases.listDocuments(
      config.mainDb,
      config.userSupportCollection,
      [Query.equal("userId", id)]
    );

    return support.documents[0] as ISupport;
  } catch (error) {
    console.error(error);
  }
};

export const updateSupport = async ({
  supports,
  supportId,
  price,
}: {
  supports: string[];
  supportId: string | null;
  price: number;
}) => {
  try {
    const owner = useAuthStore.getState().user;

    if (!owner) {
      throw new Error("Failed to get account");
    }

    if (supportId == null) {
      const create = await databases.createDocument(
        config.mainDb,
        config.userSupportCollection,
        ID.unique(),
        {
          user: owner.id,
          userId: owner.id,
          list: supports,
          price,
        },
        userAccess(owner.accountId)
      );

      return create;
    }

    const update = await databases.updateDocument(
      config.mainDb,
      config.userSupportCollection,
      supportId,
      {
        list: supports,
        price,
      }
    );

    return update;
  } catch (error) {
    console.error(error);
  }
};

export async function getUserImageAndName({ userId }: { userId: string }) {
  try {
    const user = await databases.getDocument(
      config.mainDb,
      config.userCollection,
      userId,
      [Query.select(["$id", "fullName", "imageId", "username"])]
    );

    if (!user) throw Error;

    return user as IUser;
  } catch (error) {
    console.error(error);
  }
}

export async function searchUsers(searchTerm: string) {
  try {
    const users = await databases.listDocuments(
      config.mainDb,
      config.userCollection,
      [
        Query.or([
          Query.search("fullName", searchTerm),
          Query.equal("username", searchTerm),
        ]),
      ]
    );

    if (!users) throw Error;

    return users;
  } catch (error) {
    console.error(error);
  }
}

export async function getUsers({ pageParam }: { pageParam: number }) {
  const accountId = useAuthStore.getState().user.accountId;
  const queries = [
    Query.orderDesc("$updatedAt"),
    Query.limit(20),
    Query.notEqual("accountId", accountId),
    Query.select([
      "accountId",
      "$id",
      "imageId",
      "fullName",
      "username",
      "bio",
      "$updatedAt",
    ]),
  ];

  if (pageParam) {
    queries.push(Query.cursorAfter(pageParam.toString()));
  }

  try {
    const users = await databases.listDocuments(
      config.mainDb,
      config.userCollection,
      queries
    );

    if (!users) throw new Error("No users found");

    return users;
  } catch (error) {
    console.error(error);
  }
}

export type IUserInformation = {
  phoneNumber?: string; // 30
  bio: string;
  userId: string;
  gender: string; // fking 50
  lookingFor: string;
  hobby: string; // 100
  education?: string;
  birthDate?: Date;
};

export async function updateProfileInfos(values: IUserInformation) {
  const updatedInfos = await databases.updateDocument(
    config.mainDb,
    config.userCollection,
    values.userId,
    {
      phoneNumber: values.phoneNumber,
      bio: values.bio,
      lookingFor: values.lookingFor,
      education: values.education,
      hobby: values.hobby,
      gender: values.gender,
      bDay: values.birthDate,
    }
  );
  if (!updatedInfos) throw Error;
  return updatedInfos;
}

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

export async function getLatestPost({ pageParam }: { pageParam: number }) {
  const queries: any[] = [
    Query.select([
      "$createdAt",
      "$updatedAt",
      "$id",
      "caption",
      "imageId",
      "creator.*",
      "likes",
    ]),
    Query.isNotNull("creator"),
    Query.isNotNull("image"),
    Query.orderDesc("$updatedAt"),
    Query.limit(10),
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
    defaultToast.SWW;
  }
}

export async function getUserPosts({
  pageParam,
  id,
}: {
  pageParam: number;
  id: string;
}) {
  const queries: any[] = [
    Query.orderDesc("$updatedAt"),
    Query.equal("creator", id),
    Query.limit(10),
    Query.select(["$id", "$createdAt", "*", "creator.*"]),
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

export async function searchPosts(searchTerm: string) {
  try {
    const posts = await databases.listDocuments(
      config.mainDb,
      config.postCollection,
      [Query.search("caption", searchTerm), Query.isNotNull("creator")]
    );

    if (!posts) throw Error;

    return posts;
  } catch (error) {
    defaultToast.SWW;
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
        usedDp: post.usedDp,
      },
      userToAny(post.accountId)
    );

    if (!newPost && fileUrl) {
      await deleteFile(fileUrl?.id);
      throw Error;
    }

    if (post.usedDp) {
      await databases.updateDocument(
        config.mainDb,
        config.userCollection,
        post.userId,
        {
          image: fileUrl?.fileUrl,
          imageId: fileUrl?.id,
        },
        userToAny(post.accountId)
      );
    }

    return newPost;
  } catch (error) {
    console.error(error);
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

  const user = useAuthStore.getState().user;

  try {
    if (imageId) await deleteFile(imageId);

    await databases.deleteDocument(
      config.mainDb,
      config.postCollection,
      postId
    );

    if (!imageId) throw Error;

    await databases.updateDocument(
      config.mainDb,
      config.userCollection,
      user.id,
      {
        image: null,
        imageId: null,
      }
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
// USER IN DB

export async function getUser({ id }: { id: string }) {
  try {
    const user = await databases.getDocument(
      config.mainDb,
      config.userCollection,
      id,
      [Query.select(["$id", "*"])]
    );

    if (!user) throw Error;

    return user as IUser;
  } catch (error) {
    console.error(error);
  }
}

// Conversations

export async function checkConversation({
  userId1,
  userId2,
}: {
  userId1: string;
  userId2: string;
}) {
  try {
    const conversations = await databases.listDocuments(
      config.mainDb,
      config.conversationCollection,
      [Query.contains("userIds", userId1), Query.contains("userIds", userId2)]
    );

    console.log("Have a conversation", conversations);
    return conversations.documents[0];
  } catch (error) {
    console.error(error);
  }
}

export async function getConversations({ pageParam }: { pageParam: number }) {
  const queries: any[] = [Query.orderDesc("$updatedAt"), Query.limit(10)];

  if (pageParam) {
    queries.push(Query.cursorAfter(pageParam.toString()));
  }

  try {
    const conversations = await databases.listDocuments(
      config.mainDb,
      config.conversationCollection,
      queries
    );

    if (!conversations) throw Error;

    return conversations;
  } catch (error) {
    console.error(error);
  }
}

export async function getMessages({
  pageParam,
  collectionId,
}: {
  pageParam: number;
  collectionId: string;
}) {
  const queries: any[] = [Query.orderDesc("$createdAt"), Query.limit(7)];

  if (pageParam) {
    queries.push(Query.cursorAfter(pageParam.toString()));
  }

  try {
    const conversations = await databases.listDocuments(
      config.chatDb,
      collectionId,
      queries
    );

    if (!conversations) throw Error;

    return conversations;
  } catch (error) {
    console.error(error);
  }
}

export async function sendMessage({
  collectionId,
  conversation,
  body,
}: {
  collectionId: string;
  conversation: string;
  body: string;
}) {
  try {
    const user = useAuthStore.getState().user;
    const newMessage = await databases.createDocument(
      config.chatDb,
      collectionId,
      ID.unique(),
      {
        body,
        sender: user.id,
      }
    ); // TODO: Replace with actual message sending logic

    if (!newMessage) throw Error;

    const updatedConversation = await updateConversation({
      conversation,
      sender: user.id,
      body,
    }).then(() => console.log("Updated conversation"));

    return newMessage as IMessage;
  } catch (error) {
    console.error(error);
  }
}

// Booking

export const createBooking = async ({
  ownerId,
  ownerAccountId,
  date,
  price,
}: {
  ownerId: string;
  ownerAccountId: string;
  date: Date;
  price: number;
}) => {
  try {
    const user = useAuthStore.getState().user;
    console.log(ownerAccountId, user.accountId);
    const newBooking = await databases.createDocument(
      config.mainDb,
      config.bookingCollection,
      ID.unique(),
      {
        bookerId: user.id,
        date,
        price,
        ownerId,
      },
      userToAnyUpdate(user.accountId)
    );

    if (!newBooking) throw Error;

    return newBooking;
  } catch (error) {
    console.error(error);
  }
};

export const checkIfBooked = async ({
  ownerId,
  bookerId,
}: {
  ownerId: string;
  bookerId: string;
}) => {
  try {
    const booking = await databases.listDocuments(
      config.mainDb,
      config.bookingCollection,
      [Query.equal("ownerId", ownerId), Query.equal("bookerId", bookerId)]
    );

    return booking.documents[0] as IBooking;
  } catch (error) {
    console.error(error);
  }
};
