// Keep console error output useful without serializing errors that may contain
// student records, credentials, request payloads, or database responses.
const originalConsoleError = console.error.bind(console);

console.error = (..._args: unknown[]) => {
  originalConsoleError("[MarkahKu] An unexpected error occurred.");
};
