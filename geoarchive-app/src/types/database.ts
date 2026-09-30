import type { Category } from "./photo";

export type PhotoRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: Category;
  image_path: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string;
  location_precision: "exact" | "approximate" | "none";
  visibility: "private" | "public";
  created_at: string;
};

export type ReviewRow = {
  id: string;
  photo_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      photos: {
        Row: PhotoRow;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string;
          category?: Category;
          image_path: string;
          latitude?: number | null;
          longitude?: number | null;
          location_name?: string;
          location_precision?: "exact" | "approximate" | "none";
          visibility?: "private" | "public";
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          category?: Category;
          image_path?: string;
          latitude?: number | null;
          longitude?: number | null;
          location_name?: string;
          location_precision?: "exact" | "approximate" | "none";
          visibility?: "private" | "public";
        };
        Relationships: [];
      };
      reviews: {
        Row: ReviewRow;
        Insert: {
          id?: string;
          photo_id: string;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      nearby_photos: {
        Args: {
          center_latitude: number;
          center_longitude: number;
          radius_meters: number;
        };
        Returns: PhotoRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
