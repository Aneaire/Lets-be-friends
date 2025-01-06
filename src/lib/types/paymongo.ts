type IPayMongoPaymentLink = {
  id: string;
  type: "link";
  attributes: {
    amount: number;
    archived: boolean;
    currency: string;
    description: string;
    livemode: boolean;
    fee: number;
    remarks: string | null;
    status: "unpaid" | "paid" | "refunded" | "expired";
    tax_amount: number | null;
    taxes: Array<{
      amount: number;
      currency: string;
      inclusive: boolean;
      name: string;
      type: string;
      value: string;
    }>;
    checkout_url: string;
    reference_number: string;
    created_at: number;
    updated_at: number;
    payments: Array<{
      data: {
        id: string;
        type: "payment";
        attributes: {
          access_url: string | null;
          amount: number;
          balance_transaction_id: string;
          billing: {
            address: {
              city: string;
              country: string;
              line1: string;
              line2: string;
              postal_code: string;
              state: string;
            };
            email: string;
            name: string;
            phone: string;
          };
          currency: string;
          description: string;
          disputed: boolean;
          external_reference_number: string | null;
          fee: number;
          livemode: boolean;
          net_amount: number;
          origin: string;
          payment_intent_id: string | null;
          payout: string | null;
          source: {
            id: string;
            type: string;
          };
          statement_descriptor: string;
          status: "unpaid" | "paid" | "refunded" | "failed";
          tax_amount: number | null;
          refunds: Array<{
            id: string;
            type: "refund";
            attributes: {
              amount: number;
              balance_transaction_id: string;
              currency: string;
              livemode: boolean;
              metadata: Record<string, unknown> | null;
              notes: string | null;
              payment_id: string;
              payout_id: string | null;
              reason: string;
              status: "succeeded" | "failed" | "pending";
              available_at: number | null;
              created_at: number;
              updated_at: number;
            };
          }>;
          taxes: Array<{
            amount: number;
            currency: string;
            inclusive: boolean;
            name: string;
            type: string;
            value: string;
          }>;
          available_at: number | null;
          created_at: number;
          paid_at: number | null;
          updated_at: number;
        };
      };
    }>;
  };
};

type ICreatePaymentLink = {
  success: boolean;
  link: string;
  referenceNumber: string;
};
