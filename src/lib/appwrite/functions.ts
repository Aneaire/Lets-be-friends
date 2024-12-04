import { config, functions } from "./config";

export const createConversation = async ({
  accountId1,
  accountId2,
  userId1,
  userId2,
}: {
  accountId1: string;
  accountId2: string;
  userId1: string;
  userId2: string;
}) => {
  try {
    const conversation = await functions.createExecution(
      config.createConversationFnId,
      JSON.stringify({
        accountId1,
        accountId2,
        userId1,
        userId2,
      })
    );
    return conversation.responseBody;
  } catch (error) {
    console.error(error);
  }
};

export const updateConversation = async ({
  conversation,
  sender,
  body,
}: {
  conversation: string;
  sender: string;
  body: string;
}) => {
  try {
    const convo = await functions.createExecution(
      config.manageConversationFnId,
      JSON.stringify({
        conversation,
        sender,
        body: body.slice(0, 35),
      })
    );
    return convo.responseBody;
  } catch (error) {
    console.error(error);
  }
};
