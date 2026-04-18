export type RootStackParamList = {
  Home: undefined;
  Checkout: {sessionId: string};
  Processing: {sessionId: string};
  Success: {sessionId: string; txHash: string};
};
