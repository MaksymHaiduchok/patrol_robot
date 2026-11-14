export const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
