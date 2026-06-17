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
      app_user_events: {
        Row: {
          actor_email: string;
          actor_user_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          new_role: string | null;
          old_role: string | null;
          target_email: string;
          target_user_id: string | null;
        };
        Insert: {
          actor_email: string;
          actor_user_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          new_role?: string | null;
          old_role?: string | null;
          target_email: string;
          target_user_id?: string | null;
        };
        Update: {
          actor_email?: string;
          actor_user_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          new_role?: string | null;
          old_role?: string | null;
          target_email?: string;
          target_user_id?: string | null;
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
      page_builder_comments: {
        Row: {
          block_id: string | null;
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          page_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          updated_at: string;
        };
        Insert: {
          block_id?: string | null;
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          page_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          updated_at?: string;
        };
        Update: {
          block_id?: string | null;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          page_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_builder_content_pieces: {
        Row: {
          block_type: string;
          block_variant: string;
          created_at: string;
          id: string;
          internal_tags: string[];
          page_type: string;
          payload: Json;
          provenance: Json;
          route_path: string;
          source_block_id: string;
          source_page_id: string;
          source_revision_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          block_type: string;
          block_variant: string;
          created_at?: string;
          id?: string;
          internal_tags?: string[];
          page_type: string;
          payload?: Json;
          provenance?: Json;
          route_path: string;
          source_block_id: string;
          source_page_id: string;
          source_revision_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          block_type?: string;
          block_variant?: string;
          created_at?: string;
          id?: string;
          internal_tags?: string[];
          page_type?: string;
          payload?: Json;
          provenance?: Json;
          route_path?: string;
          source_block_id?: string;
          source_page_id?: string;
          source_revision_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_builder_route_prefixes: {
        Row: {
          created_at: string;
          id: string;
          is_default: boolean;
          label: string;
          prefix: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          prefix: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          prefix?: string;
        };
        Relationships: [];
      };
      lead_submissions: {
        Row: {
          budget: string | null;
          business_stage: string | null;
          city: string | null;
          close_contact_id: string | null;
          close_lead_id: string | null;
          close_sync_attempt_count: number;
          close_sync_last_attempted_at: string | null;
          close_sync_last_error: string | null;
          close_sync_next_retry_at: string | null;
          close_sync_status: string | null;
          close_sync_synced_at: string | null;
          created_at: string;
          email: string;
          form_type: string;
          full_name: string;
          id: string;
          idempotency_key: string;
          landing_path: string | null;
          latest_qualification_completed_at: string | null;
          latest_qualification_form_id: string | null;
          latest_qualification_form_version_id: string | null;
          latest_qualification_session_id: string | null;
          latest_qualification_started_at: string | null;
          lifecycle_status: string;
          message: string | null;
          metadata: Json;
          notification_attempted_at: string | null;
          notification_error: string | null;
          notification_sent_at: string | null;
          phone: string | null;
          qualification_summary: Json;
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
          close_contact_id?: string | null;
          close_lead_id?: string | null;
          close_sync_attempt_count?: number;
          close_sync_last_attempted_at?: string | null;
          close_sync_last_error?: string | null;
          close_sync_next_retry_at?: string | null;
          close_sync_status?: string | null;
          close_sync_synced_at?: string | null;
          created_at?: string;
          email: string;
          form_type: string;
          full_name: string;
          id?: string;
          idempotency_key: string;
          landing_path?: string | null;
          latest_qualification_completed_at?: string | null;
          latest_qualification_form_id?: string | null;
          latest_qualification_form_version_id?: string | null;
          latest_qualification_session_id?: string | null;
          latest_qualification_started_at?: string | null;
          lifecycle_status?: string;
          message?: string | null;
          metadata?: Json;
          notification_attempted_at?: string | null;
          notification_error?: string | null;
          notification_sent_at?: string | null;
          phone?: string | null;
          qualification_summary?: Json;
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
          close_contact_id?: string | null;
          close_lead_id?: string | null;
          close_sync_attempt_count?: number;
          close_sync_last_attempted_at?: string | null;
          close_sync_last_error?: string | null;
          close_sync_next_retry_at?: string | null;
          close_sync_status?: string | null;
          close_sync_synced_at?: string | null;
          created_at?: string;
          email?: string;
          form_type?: string;
          full_name?: string;
          id?: string;
          idempotency_key?: string;
          landing_path?: string | null;
          latest_qualification_completed_at?: string | null;
          latest_qualification_form_id?: string | null;
          latest_qualification_form_version_id?: string | null;
          latest_qualification_session_id?: string | null;
          latest_qualification_started_at?: string | null;
          lifecycle_status?: string;
          message?: string | null;
          metadata?: Json;
          notification_attempted_at?: string | null;
          notification_error?: string | null;
          notification_sent_at?: string | null;
          phone?: string | null;
          qualification_summary?: Json;
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
      qualification_forms: {
        Row: {
          created_at: string;
          created_by: string | null;
          current_published_version_id: string | null;
          draft_schema: Json;
          id: string;
          is_default: boolean;
          name: string;
          slug: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          current_published_version_id?: string | null;
          draft_schema?: Json;
          id?: string;
          is_default?: boolean;
          name: string;
          slug?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          current_published_version_id?: string | null;
          draft_schema?: Json;
          id?: string;
          is_default?: boolean;
          name?: string;
          slug?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      qualification_form_versions: {
        Row: {
          created_at: string;
          form_id: string;
          id: string;
          normalized_roles: string[];
          published_at: string;
          published_by: string | null;
          question_count: number;
          schema_snapshot: Json;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          form_id: string;
          id?: string;
          normalized_roles?: string[];
          published_at?: string;
          published_by?: string | null;
          question_count?: number;
          schema_snapshot: Json;
          version_number: number;
        };
        Update: {
          created_at?: string;
          form_id?: string;
          id?: string;
          normalized_roles?: string[];
          published_at?: string;
          published_by?: string | null;
          question_count?: number;
          schema_snapshot?: Json;
          version_number?: number;
        };
        Relationships: [];
      };
      qualification_sessions: {
        Row: {
          answer_count: number;
          completed_at: string | null;
          completion_redirect_path: string | null;
          consent_accepted_at: string | null;
          consent_question_snapshot: Json | null;
          consent_source_attribution: Json;
          consent_user_agent: string | null;
          created_at: string;
          current_question_id: string | null;
          experiment_key: string | null;
          expires_at: string;
          form_id: string;
          form_version_id: string;
          id: string;
          landing_path: string | null;
          lead_submission_id: string;
          normalized_summary: Json;
          referrer: string | null;
          session_token_hash: string;
          source_block_id: string | null;
          source_cta_tracking_name: string | null;
          source_page_id: string | null;
          source_page_slug: string | null;
          source_path: string | null;
          stale_at: string;
          started_at: string | null;
          status: string;
          target_keyword: string | null;
          updated_at: string;
          user_agent: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          utm_term: string | null;
          variant_key: string | null;
        };
        Insert: {
          answer_count?: number;
          completed_at?: string | null;
          completion_redirect_path?: string | null;
          consent_accepted_at?: string | null;
          consent_question_snapshot?: Json | null;
          consent_source_attribution?: Json;
          consent_user_agent?: string | null;
          created_at?: string;
          current_question_id?: string | null;
          experiment_key?: string | null;
          expires_at: string;
          form_id: string;
          form_version_id: string;
          id?: string;
          landing_path?: string | null;
          lead_submission_id: string;
          normalized_summary?: Json;
          referrer?: string | null;
          session_token_hash: string;
          source_block_id?: string | null;
          source_cta_tracking_name?: string | null;
          source_page_id?: string | null;
          source_page_slug?: string | null;
          source_path?: string | null;
          stale_at: string;
          started_at?: string | null;
          status?: string;
          target_keyword?: string | null;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
          variant_key?: string | null;
        };
        Update: {
          answer_count?: number;
          completed_at?: string | null;
          completion_redirect_path?: string | null;
          consent_accepted_at?: string | null;
          consent_question_snapshot?: Json | null;
          consent_source_attribution?: Json;
          consent_user_agent?: string | null;
          created_at?: string;
          current_question_id?: string | null;
          experiment_key?: string | null;
          expires_at?: string;
          form_id?: string;
          form_version_id?: string;
          id?: string;
          landing_path?: string | null;
          lead_submission_id?: string;
          normalized_summary?: Json;
          referrer?: string | null;
          session_token_hash?: string;
          source_block_id?: string | null;
          source_cta_tracking_name?: string | null;
          source_page_id?: string | null;
          source_page_slug?: string | null;
          source_path?: string | null;
          stale_at?: string;
          started_at?: string | null;
          status?: string;
          target_keyword?: string | null;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
          variant_key?: string | null;
        };
        Relationships: [];
      };
      qualification_answers: {
        Row: {
          answer_value: Json;
          answered_at: string;
          created_at: string;
          form_version_id: string;
          id: string;
          lead_submission_id: string;
          normalized_role: string | null;
          normalized_value: Json;
          option_snapshots: Json;
          question_id: string;
          question_snapshot: Json;
          question_type: string;
          session_id: string;
          updated_at: string;
        };
        Insert: {
          answer_value: Json;
          answered_at?: string;
          created_at?: string;
          form_version_id: string;
          id?: string;
          lead_submission_id: string;
          normalized_role?: string | null;
          normalized_value?: Json;
          option_snapshots?: Json;
          question_id: string;
          question_snapshot: Json;
          question_type: string;
          session_id: string;
          updated_at?: string;
        };
        Update: {
          answer_value?: Json;
          answered_at?: string;
          created_at?: string;
          form_version_id?: string;
          id?: string;
          lead_submission_id?: string;
          normalized_role?: string | null;
          normalized_value?: Json;
          option_snapshots?: Json;
          question_id?: string;
          question_snapshot?: Json;
          question_type?: string;
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      close_sync_events: {
        Row: {
          attempt_count: number;
          close_contact_id: string | null;
          close_lead_id: string | null;
          created_at: string;
          dedupe_key: string | null;
          event_type: string;
          id: string;
          last_attempted_at: string | null;
          last_error: string | null;
          lead_submission_id: string | null;
          max_attempts: number;
          next_retry_at: string;
          payload: Json;
          session_id: string | null;
          status: string;
          synced_at: string | null;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          close_contact_id?: string | null;
          close_lead_id?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          event_type: string;
          id?: string;
          last_attempted_at?: string | null;
          last_error?: string | null;
          lead_submission_id?: string | null;
          max_attempts?: number;
          next_retry_at?: string;
          payload?: Json;
          session_id?: string | null;
          status?: string;
          synced_at?: string | null;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          close_contact_id?: string | null;
          close_lead_id?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          event_type?: string;
          id?: string;
          last_attempted_at?: string | null;
          last_error?: string | null;
          lead_submission_id?: string | null;
          max_attempts?: number;
          next_retry_at?: string;
          payload?: Json;
          session_id?: string | null;
          status?: string;
          synced_at?: string | null;
          updated_at?: string;
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
          draft_settings: Json;
          campaign_label: string | null;
          footer_variant: Json;
          funnel_stage: string | null;
          id: string;
          internal_tags: string[];
          lifecycle_status: string;
          meta_description: string | null;
          next_review_at: string | null;
          noindex: boolean;
          og_asset_id: string | null;
          og_description: string | null;
          og_title: string | null;
          page_type: string;
          published_at: string | null;
          published_content: Json | null;
          published_revision_id: string | null;
          review_period_months: number;
          route_path: string;
          route_prefix: string;
          scheduled_publish_at: string | null;
          scheduled_publish_attempts: number;
          scheduled_publish_error: string | null;
          scheduled_publish_last_attempt_at: string | null;
          scheduled_publish_locked_at: string | null;
          scheduled_publish_status: string;
          seo_title: string | null;
          sitemap_enabled: boolean;
          slug: string;
          status: string;
          structured_data_settings: Json;
          target_keyword: string | null;
          template_key: string;
          title: string;
          topic_cluster: string | null;
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
          draft_settings?: Json;
          campaign_label?: string | null;
          footer_variant?: Json;
          funnel_stage?: string | null;
          id?: string;
          internal_tags?: string[];
          lifecycle_status?: string;
          meta_description?: string | null;
          next_review_at?: string | null;
          noindex?: boolean;
          og_asset_id?: string | null;
          og_description?: string | null;
          og_title?: string | null;
          page_type?: string;
          published_at?: string | null;
          published_content?: Json | null;
          published_revision_id?: string | null;
          review_period_months?: number;
          route_path?: string;
          route_prefix?: string;
          scheduled_publish_at?: string | null;
          scheduled_publish_attempts?: number;
          scheduled_publish_error?: string | null;
          scheduled_publish_last_attempt_at?: string | null;
          scheduled_publish_locked_at?: string | null;
          scheduled_publish_status?: string;
          seo_title?: string | null;
          sitemap_enabled?: boolean;
          slug: string;
          status?: string;
          structured_data_settings?: Json;
          target_keyword?: string | null;
          template_key?: string;
          title: string;
          topic_cluster?: string | null;
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
          draft_settings?: Json;
          campaign_label?: string | null;
          footer_variant?: Json;
          funnel_stage?: string | null;
          id?: string;
          internal_tags?: string[];
          lifecycle_status?: string;
          meta_description?: string | null;
          next_review_at?: string | null;
          noindex?: boolean;
          og_asset_id?: string | null;
          og_description?: string | null;
          og_title?: string | null;
          page_type?: string;
          published_at?: string | null;
          published_content?: Json | null;
          published_revision_id?: string | null;
          review_period_months?: number;
          route_path?: string;
          route_prefix?: string;
          scheduled_publish_at?: string | null;
          scheduled_publish_attempts?: number;
          scheduled_publish_error?: string | null;
          scheduled_publish_last_attempt_at?: string | null;
          scheduled_publish_locked_at?: string | null;
          scheduled_publish_status?: string;
          seo_title?: string | null;
          sitemap_enabled?: boolean;
          slug?: string;
          status?: string;
          structured_data_settings?: Json;
          target_keyword?: string | null;
          template_key?: string;
          title?: string;
          topic_cluster?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      published_seo_pages: {
        Row: {
          canonical_url: string | null;
          id: string;
          meta_description: string | null;
          noindex: boolean;
          page_type: string;
          published_at: string | null;
          published_content: Json | null;
          route_path: string;
          route_prefix: string;
          seo_title: string | null;
          sitemap_enabled: boolean;
          slug: string;
          structured_data_settings: Json;
          target_keyword: string | null;
          title: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      apply_seo_page_revision_update_atomically: {
        Args: {
          p_actor_id: string | null;
          p_content_snapshot: Json;
          p_draft_content: Json;
          p_page_id: string;
          p_revision_label: string;
          p_revision_type: string;
          p_seo_patch: Json;
          p_seo_snapshot: Json;
        };
        Returns: Json;
      };
      archive_seo_page_atomically: {
        Args: {
          p_actor_id: string | null;
          p_archive_behavior: string;
          p_archive_redirect_url: string | null;
          p_archived_at: string;
          p_current_slug: string | null;
          p_page_id: string;
        };
        Returns: Json;
      };
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
      prune_seo_page_manual_save_revisions: {
        Args: {
          p_page_id: string;
          p_keep?: number;
        };
        Returns: number;
      };
      publish_seo_page_atomically: {
        Args: {
          p_actor_id: string | null;
          p_canonical_url: string | null;
          p_meta_description: string | null;
          p_noindex: boolean;
          p_page_id: string;
          p_published_at: string;
          p_published_content: Json;
          p_revision_label?: string | null;
          p_route_path: string;
          p_route_prefix: string;
          p_seo_snapshot: Json;
          p_seo_title: string | null;
          p_sitemap_enabled: boolean;
          p_slug: string;
          p_structured_data_settings: Json;
          p_target_keyword: string | null;
          p_title: string;
        };
        Returns: Json;
      };
      update_seo_page_slug_with_redirect: {
        Args: {
          p_actor_id: string | null;
          p_next_slug: string;
          p_next_route_path: string;
          p_next_route_prefix: string;
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
