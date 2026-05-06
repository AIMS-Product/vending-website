export function resolveRedirectDestination(
  request: { url: string; nextUrl: { searchParams: URLSearchParams } },
  destinationPath: string,
) {
  const destination = new URL(destinationPath, request.url);
  if (!destination.search) {
    request.nextUrl.searchParams.forEach((value, key) => {
      destination.searchParams.append(key, value);
    });
  }
  return destination;
}
