export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1 block text-xs font-semibold text-red-700">
      {message}
    </span>
  );
}
