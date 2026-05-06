export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_user_emails: {
        Row: {
          added_at: string;
          email: string;
          role: string;
        };
        Insert: {
          added_at?: string;
          email: string;
          role?: string;
        };
        Update: {
          added_at?: string;
          email?: string;
          role?: string;
        };
        Relationships: [];
      };
      app_users: {
        Row: {
          added_at: string;
          email: string;
          role: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          email: string;
          role?: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          email?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lead_submissions: {
        Row: {
          budget: string | null;
          business_stage: string | null;
          city: string | null;
          created_at: string;
          email: string;
          form_type: string;
          full_name: string;
          id: string;
          idempotency_key: string;
          landing_path: string | null;
          message: string | null;
          metadata: Json;
          notification_attempted_at: string | null;
          notification_error: string | null;
          notification_sent_at: string | null;
          phone: string | null;
          referrer: string | null;
          source_block_id: string | null;
          source_cta_tracking_name: string | null;
          source_page_id: string | null;
          source_page_slug: string | null;
          source_path: string | null;
          state_region: string | null;
          status: string;
          target_keyword: string | null;
          timeline: string | null;
          updated_at: string;
          user_agent: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          utm_term: string | null;
        };
        Insert: {
          budget?: string | null;
          business_stage?: string | null;
          city?: string | null;
          created_at?: string;
          email: string;
          form_type: string;
          full_name: string;
          id?: string;
          idempotency_key: string;
          landing_path?: string | null;
          message?: string | null;
          metadata?: Json;
          notification_attempted_at?: string | null;
          notification_error?: string | null;
          notification_sent_at?: string | null;
          phone?: string | null;
          referrer?: string | null;
          source_block_id?: string | null;
          source_cta_tracking_name?: string | null;
          source_page_id?: string | null;
          source_page_slug?: string | null;
          source_path?: string | null;
          state_region?: string | null;
          status?: string;
          target_keyword?: string | null;
          timeline?: string | null;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Update: {
          budget?: string | null;
          business_stage?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string;
          form_type?: string;
          full_name?: string;
          id?: string;
          idempotency_key?: string;
          landing_path?: string | null;
          message?: string | null;
          metadata?: Json;
          notification_attempted_at?: string | null;
          notification_error?: string | null;
          notification_sent_at?: string | null;
          phone?: string | null;
          referrer?: string | null;
          source_block_id?: string | null;
          source_cta_tracking_name?: string | null;
          source_page_id?: string | null;
          source_page_slug?: string | null;
          source_path?: string | null;
          state_region?: string | null;
          status?: string;
          target_keyword?: string | null;
          timeline?: string | null;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          alt_text: string | null;
          asset_type: string;
          caption: string | null;
          created_at: string;
          duration_seconds: number | null;
          external_url: string | null;
          height: number | null;
          id: string;
          source_rights_notes: string | null;
          storage_bucket: string | null;
          storage_path: string | null;
          tags: string[];
          thumbnail_asset_id: string | null;
          title: string;
          updated_at: string;
          uploaded_by: string | null;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          asset_type: string;
          caption?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          external_url?: string | null;
          height?: number | null;
          id?: string;
          source_rights_notes?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          tags?: string[];
          thumbnail_asset_id?: string | null;
          title: string;
          updated_at?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          asset_type?: string;
          caption?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          external_url?: string | null;
          height?: number | null;
          id?: string;
          source_rights_notes?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          tags?: string[];
          thumbnail_asset_id?: string | null;
          title?: string;
          updated_at?: string;
          uploaded_by?: string | null;
          width?: number | null;
        };
        Relationships: [];
      };
      proof_items: {
        Row: {
          approved: boolean;
          asset_id: string | null;
          body: string;
          created_at: string;
          id: string;
          kind: string;
          name: string | null;
          role_or_context: string | null;
          source_rights_notes: string | null;
          updated_at: string;
        };
        Insert: {
          approved?: boolean;
          asset_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          kind: string;
          name?: string | null;
          role_or_context?: string | null;
          source_rights_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          approved?: boolean;
          asset_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string | null;
          role_or_context?: string | null;
          source_rights_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cta_presets: {
        Row: {
          created_at: string;
          href: string;
          id: string;
          label: string;
          style_preset: string;
          tracking_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          href: string;
          id?: string;
          label: string;
          style_preset?: string;
          tracking_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          href?: string;
          id?: string;
          label?: string;
          style_preset?: string;
          tracking_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      source_documents: {
        Row: {
          asset_id: string | null;
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          source_type: string;
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          asset_id?: string | null;
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          source_type: string;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          asset_id?: string | null;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          source_type?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      source_excerpts: {
        Row: {
          approved: boolean;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          excerpt: string;
          id: string;
          source_document_id: string;
          topic_tags: string[];
          updated_at: string;
        };
        Insert: {
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          excerpt: string;
          id?: string;
          source_document_id: string;
          topic_tags?: string[];
          updated_at?: string;
        };
        Update: {
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          excerpt?: string;
          id?: string;
          source_document_id?: string;
          topic_tags?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      approved_claims: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          claim: string;
          claim_type: string;
          created_at: string;
          id: string;
          risk_level: string;
          source_excerpt_id: string;
          updated_at: string;
          usage_notes: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          claim: string;
          claim_type?: string;
          created_at?: string;
          id?: string;
          risk_level?: string;
          source_excerpt_id: string;
          updated_at?: string;
          usage_notes?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          claim?: string;
          claim_type?: string;
          created_at?: string;
          id?: string;
          risk_level?: string;
          source_excerpt_id?: string;
          updated_at?: string;
          usage_notes?: string | null;
        };
        Relationships: [];
      };
      ai_page_proposals: {
        Row: {
          accepted_at: string | null;
          accepted_block_ids: string[];
          accepted_by: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          model: string;
          page_id: string;
          prompt_version: string;
          proposal_json: Json;
          selected_approved_claim_ids: string[];
          selected_source_document_ids: string[];
          selected_source_excerpt_ids: string[];
          status: string;
          updated_at: string;
          warnings: Json;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_block_ids?: string[];
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model: string;
          page_id: string;
          prompt_version: string;
          proposal_json: Json;
          selected_approved_claim_ids?: string[];
          selected_source_document_ids?: string[];
          selected_source_excerpt_ids?: string[];
          status?: string;
          updated_at?: string;
          warnings?: Json;
        };
        Update: {
          accepted_at?: string | null;
          accepted_block_ids?: string[];
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model?: string;
          page_id?: string;
          prompt_version?: string;
          proposal_json?: Json;
          selected_approved_claim_ids?: string[];
          selected_source_document_ids?: string[];
          selected_source_excerpt_ids?: string[];
          status?: string;
          updated_at?: string;
          warnings?: Json;
        };
        Relationships: [];
      };
      news_posts: {
        Row: {
          author: string | null;
          body: string;
          cover_alt: string | null;
          cover_url: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published_at: string | null;
          slug: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author?: string | null;
          body: string;
          cover_alt?: string | null;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          slug: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author?: string | null;
          body?: string;
          cover_alt?: string | null;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          slug?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_revisions: {
        Row: {
          content_snapshot: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          label: string | null;
          page_id: string;
          revision_type: string;
          seo_snapshot: Json;
        };
        Insert: {
          content_snapshot: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string | null;
          page_id: string;
          revision_type: string;
          seo_snapshot?: Json;
        };
        Update: {
          content_snapshot?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string | null;
          page_id?: string;
          revision_type?: string;
          seo_snapshot?: Json;
        };
        Relationships: [];
      };
      page_preview_tokens: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          page_id: string;
          revoked_at: string | null;
          token_hash: string;
          token_prefix: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          page_id: string;
          revoked_at?: string | null;
          token_hash: string;
          token_prefix: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          page_id?: string;
          revoked_at?: string | null;
          token_hash?: string;
          token_prefix?: string;
        };
        Relationships: [];
      };
      redirects: {
        Row: {
          created_at: string;
          created_by: string | null;
          created_reason: string;
          destination_path: string;
          id: string;
          page_id: string | null;
          source_path: string;
          status_code: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          created_reason?: string;
          destination_path: string;
          id?: string;
          page_id?: string | null;
          source_path: string;
          status_code?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          created_reason?: string;
          destination_path?: string;
          id?: string;
          page_id?: string | null;
          source_path?: string;
          status_code?: number;
        };
        Relationships: [];
      };
      seo_pages: {
        Row: {
          archive_behavior: string;
          archive_redirect_url: string | null;
          archived_at: string | null;
          canonical_url: string | null;
          created_at: string;
          created_by: string | null;
          draft_content: Json;
          id: string;
          meta_description: string | null;
          noindex: boolean;
          og_asset_id: string | null;
          page_type: string;
          published_at: string | null;
          published_content: Json | null;
          published_revision_id: string | null;
          seo_title: string | null;
          sitemap_enabled: boolean;
          slug: string;
          status: string;
          structured_data_settings: Json;
          target_keyword: string | null;
          template_key: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          archive_behavior?: string;
          archive_redirect_url?: string | null;
          archived_at?: string | null;
          canonical_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          draft_content?: Json;
          id?: string;
          meta_description?: string | null;
          noindex?: boolean;
          og_asset_id?: string | null;
          page_type?: string;
          published_at?: string | null;
          published_content?: Json | null;
          published_revision_id?: string | null;
          seo_title?: string | null;
          sitemap_enabled?: boolean;
          slug: string;
          status?: string;
          structured_data_settings?: Json;
          target_keyword?: string | null;
          template_key?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archive_behavior?: string;
          archive_redirect_url?: string | null;
          archived_at?: string | null;
          canonical_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          draft_content?: Json;
          id?: string;
          meta_description?: string | null;
          noindex?: boolean;
          og_asset_id?: string | null;
          page_type?: string;
          published_at?: string | null;
          published_content?: Json | null;
          published_revision_id?: string | null;
          seo_title?: string | null;
          sitemap_enabled?: boolean;
          slug?: string;
          status?: string;
          structured_data_settings?: Json;
          target_keyword?: string | null;
          template_key?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_ai_proposal_blocks: {
        Args: {
          p_accepted_at: string;
          p_accepted_block_ids: string[];
          p_actor_id: string | null;
          p_label: string;
          p_next_content: Json;
          p_page_id: string;
          p_proposal_id: string;
          p_seo_snapshot: Json;
        };
        Returns: Json;
      };
      is_app_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      update_seo_page_slug_with_redirect: {
        Args: {
          p_actor_id: string | null;
          p_next_slug: string;
          p_page_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
