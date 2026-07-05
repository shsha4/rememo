export const electronAPI = window.electronAPI;

export async function testConnection(): Promise<boolean> {
  try {
    const result = await electronAPI.ping();
    return result === 'pong';
  } catch (error) {
    console.error('Failed to connect to main process:', error);
    return false;
  }
}

export async function getPlatform(): Promise<string> {
  return electronAPI.system.getPlatform();
}
