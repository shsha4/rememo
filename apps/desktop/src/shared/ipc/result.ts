export interface IpcSuccess<T> {
  success: true;
  data: T;
}
export interface IpcFailure {
  success: false;
  error: { code: string; message: string };
}
export type IpcResult<T> = IpcSuccess<T> | IpcFailure;
