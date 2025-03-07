// plaidHelper.ts
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";

export const createPlaidLinkToken = async (userId: string) => {
  try {
    const response = await axios.post(`https://${PLAID_ENV}.plaid.com/link/token/create`, {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      client_name: "My App",
      user: { client_user_id: userId },
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
      webhook: "https://your-webhook-url.com",
      redirect_uri: "https://your-app.com/oauth-page",
    });

    return response.data.link_token;
  } catch (err) {
    console.error("Failed to create Plaid link token:", err.response?.data || err.message);
    throw new Error("Could not create Plaid link token.");
  }
};

export const exchangePlaidPublicToken = async (publicToken: string) => {
  try {
    const response = await axios.post(`https://${PLAID_ENV}.plaid.com/item/public_token/exchange`, {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      public_token: publicToken,
    });

    return response.data.access_token; // Save this access token in the database
  } catch (err) {
    console.error("Failed to exchange public token:", err.response?.data || err.message);
    throw new Error("Could not exchange public token.");
  }
};

export const createPlaidProcessorToken = async (accessToken: string, accountId: string) => {
  try {
    const response = await axios.post(`https://${PLAID_ENV}.plaid.com/processor/token/create`, {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      access_token: accessToken,
      account_id: accountId,
      processor: "dwolla",
    });

    return response.data.processor_token;
  } catch (err) {
    console.error("Failed to create Plaid processor token:", err.response?.data || err.message);
    throw new Error("Could not create processor token.");
  }
};
