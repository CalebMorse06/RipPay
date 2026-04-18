export type RootStackParamList = {
  Home: undefined;
  /** NFC/merchant-link entry point — resolves merchantId → active session */
  MerchantLanding: {merchantId: string};
  Checkout: {sessionId: string};
  Processing: {sessionId: string};
  Success: {sessionId: string; txHash: string};
};
