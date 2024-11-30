import { config, functions } from "./config";

export const createConversation = async (
  accountId1: string,
  accountId2: string
) => {
  try {
    const conversation = await functions.createExecution(
      config.createConversationFnId,
      JSON.stringify({
        accountId1,
        accountId2,
      })
    );
    return conversation.responseBody;
  } catch (error) {
    console.error(error);
  }
};
