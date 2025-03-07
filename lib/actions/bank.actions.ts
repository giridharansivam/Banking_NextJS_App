"use server";

import {
  ACHClass,
  CountryCode,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferNetwork,
  TransferType,
} from "plaid";

import { plaidClient } from "../plaid";
import { parseStringify } from "../utils";

import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank } from "./user.actions";

// Get multiple bank accounts
// Get multiple bank accounts
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    // get banks from db
    const banks = await getBanks({ userId });

    if (!banks || banks.length === 0) {
      console.error("No banks found for the user.");
      return parseStringify({ data: [], totalBanks: 0, totalCurrentBalance: 0 });
    }

    const accounts = await Promise.all(
      banks?.map(async (bank: Bank) => {
        // Ensure bank has an access token
        if (!bank.accessToken) {
          console.error(`Bank ${bank.$id} does not have an access token.`);
          return null;
        }

        // Get each account info from Plaid
        const accountsResponse = await plaidClient.accountsGet({
          access_token: bank.accessToken,
        });

        // Ensure accountsResponse contains data
        if (!accountsResponse || !accountsResponse.data || !accountsResponse.data.accounts) {
          console.error(`No account data found for bank ${bank.$id}`);
          return null;
        }

        const accountData = accountsResponse.data.accounts[0];

        // Get institution info from Plaid
        const institution = await getInstitution({
          institutionId: accountsResponse.data.item.institution_id!,
        });

        return {
          id: accountData.account_id,
          availableBalance: accountData.balances.available!,
          currentBalance: accountData.balances.current!,
          institutionId: institution.institution_id,
          name: accountData.name,
          officialName: accountData.official_name,
          mask: accountData.mask!,
          type: accountData.type as string,
          subtype: accountData.subtype! as string,
          appwriteItemId: bank.$id,
          sharaebleId: bank.shareableId,
        };
      })
    );

    // Filter out null accounts
    const validAccounts = accounts.filter((account) => account !== null);

    const totalBanks = validAccounts.length;
    const totalCurrentBalance = validAccounts.reduce((total, account) => {
      return total + account.currentBalance;
    }, 0);

    return parseStringify({ data: validAccounts, totalBanks, totalCurrentBalance });
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};


// Get one bank account
// Get one bank account
export const getAccount = async ({ appwriteItemId }: getAccountProps) => {
  try {
    // Get bank from db
    const bank = await getBank({ documentId: appwriteItemId });

    if (!bank || !bank.accessToken) {
      console.error("Bank or access token is missing.");
      return;
    }

    // Get account info from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: bank.accessToken,
    });

    if (!accountsResponse || !accountsResponse.data || !accountsResponse.data.accounts[0]) {
      console.error("No account data found for the bank.");
      return;
    }

    const accountData = accountsResponse.data.accounts[0];

    // Get transfer transactions from Appwrite
    const transferTransactionsData = await getTransactionsByBankId({
      bankId: bank.$id,
    });

    const transferTransactions = transferTransactionsData.documents.map(
      (transferData: Transaction) => ({
        id: transferData.$id,
        name: transferData.name!,
        amount: transferData.amount!,
        date: transferData.$createdAt,
        paymentChannel: transferData.channel,
        category: transferData.category,
        type: transferData.senderBankId === bank.$id ? "debit" : "credit",
      })
    );

    // Get institution info from Plaid
    const institution = await getInstitution({
      institutionId: accountsResponse.data.item.institution_id!,
    });

    const transactions = await getTransactions({
      accessToken: bank?.accessToken,
    });

    const account = {
      id: accountData.account_id,
      availableBalance: accountData.balances.available!,
      currentBalance: accountData.balances.current!,
      institutionId: institution.institution_id,
      name: accountData.name,
      officialName: accountData.official_name,
      mask: accountData.mask!,
      type: accountData.type as string,
      subtype: accountData.subtype! as string,
      appwriteItemId: bank.$id,
    };

    // Sort transactions by date (most recent first)
    const allTransactions = [...transactions, ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("An error occurred while getting the account:", error);
  }
};

// Get bank info
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  try {
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ["US"] as CountryCode[],
    });

    const intitution = institutionResponse.data.institution;

    return parseStringify(intitution);
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
  }
};

// Get transactions
// Get transactions
export const getTransactions = async ({
  accessToken,
}: getTransactionsProps) => {
  let hasMore = true;
  let transactions: any = [];

  try {
    // Iterate through each page of new transaction updates for item
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
      });

      // Safely check if the response contains `added` data
      if (response.data && response.data.added) {
        transactions = response.data.added.map((transaction) => ({
          id: transaction.transaction_id,
          name: transaction.name,
          paymentChannel: transaction.payment_channel,
          type: transaction.payment_channel,
          accountId: transaction.account_id,
          amount: transaction.amount,
          pending: transaction.pending,
          category: transaction.category ? transaction.category[0] : "",
          date: transaction.date,
          image: transaction.logo_url,
        }));
      } else {
        console.error("No added transactions found in the response");
      }

      hasMore = response.data.has_more;

      // If there are more transactions, continue fetching the next set
      if (hasMore) {
        console.log("Fetching more transactions...");
      }
    }

    return parseStringify(transactions);
  } catch (error) {
    // Log detailed error information
    console.error("An error occurred while fetching transactions:", error);
    throw error; // Optionally, you can throw the error again or handle it accordingly
  }
};
