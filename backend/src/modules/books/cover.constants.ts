export const COVER_TICKET_TTL_SECONDS = 60 * 60;
export const coverTicketKey = (publicId: string) => `cover:${publicId}`;

const COVER_FOLDER = 'bookstation/covers';
export const COVER_PUBLIC_ID_PATTERN =
  /^bookstation\/covers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const coverPublicId = (id: string) => `${COVER_FOLDER}/${id}`;
