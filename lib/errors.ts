export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_ERROR",
  ) {
    super(message);
  }
}
export function invariant(
  condition: unknown,
  message = "You do not have access to this resource.",
  status = 403,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
