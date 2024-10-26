import { ID, Query } from "appwrite";
import { toast } from "sonner";
import { globalConfig } from "../globalConfig";
import { ICreateAccount } from "../types";
import { account, config, databases, storage } from "./config";
import { userAccess } from "./permissions";

// Handling accounts
export const signIn = async (email: string, password: string) => {
  try {
    const accountSignedIn = await account.createEmailPasswordSession(
      email,
      password
    );
    if (!accountSignedIn) {
      throw new Error("Failed to sign in");
    }

    return accountSignedIn;
  } catch (error) {
    console.log(error);
  }
};

export async function signOutAccount() {
  try {
    const session = account.deleteSession("current");
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
    console.log(accountId);
    const user = await databases.createDocument(
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
      [Query.search("accountId", acc.$id)]
    );

    console.log(user);

    return user.documents[0];
  } catch (error) {
    console.error(error);
  }
};

// Images

export const getProfileImage = async (imageId: string, quality: number) => {
  const image = await storage.getFilePreview(
    config.postBucket,
    imageId,
    undefined, // width
    undefined, // height
    undefined, // gravity
    quality // quality
  );
  console.log(image);
  return image;
};

// Post

export async function createTextPost({
  caption,
  creator,
}: {
  caption: string;
  creator: string;
}) {
  try {
    const currentAccount = await account.get();
    const newPost = await databases.createDocument(
      config.mainDb,
      config.postCollection,
      ID.unique(),
      {
        creator: creator,
        creatorId: creator,
        caption: caption,
        tags: [""],
        location: "",
      },
      userAccess(currentAccount.$id)
    );

    if (!newPost) throw Error;

    return newPost;
  } catch (error) {
    toast.error("Something went wrong");
  }
}
