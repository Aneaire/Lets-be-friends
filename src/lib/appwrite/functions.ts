import { z } from "zod";
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

export const createPaymentLinkValidation = z.object({
  bookingId: z.string().max(40),
  amount: z.number(),
  description: z.string().max(500),
});

export const createPaymentLink = async ({
  bookingId,
  amount,
  description,
}: z.infer<typeof createPaymentLinkValidation>) => {
  try {
    console.log(bookingId);
    const paymentLink = await functions.createExecution(
      config.paymongoFnId,
      JSON.stringify({
        bookingId,
        amount,
        description,
      })
    );
    const parsedData: ICreatePaymentLink = JSON.parse(paymentLink.responseBody);
    return parsedData;
  } catch (error) {
    console.error(error);
  }
};

export const retrievePaymentFromPaymongo = async ({
  referenceNumber,
  bookingId,
}: {
  referenceNumber: string;
  bookingId: string;
}) => {
  try {
    const paymentLink = await functions.createExecution(
      config.paymongoFnId,
      JSON.stringify({
        referenceNumber,
        type: "retrieve",
        bookingId,
      })
    );
    const parsedData: IPayMongoPaymentLink["attributes"] = JSON.parse(
      paymentLink.responseBody
    );
    console.log("Retrieve payment", parsedData);
    return parsedData;
  } catch (error) {
    console.error(error);
  }
};
