export type ReviewRecord = {
  id: string;
  placeId: string;
  photoId: string | null;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  username?: string | null;
  displayName?: string | null;
};
