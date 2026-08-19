/**
 * Hand-authored Database types for Phase 1.3 domain schema.
 * Prefer regenerating with `pnpm gen:types` after `supabase db reset`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PlatformRoleEnum =
  | 'member'
  | 'compliance_officer'
  | 'platform_admin'
  | 'super_admin';

export type KycStatusEnum =
  | 'not_started'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected';

export type JamiyaStatusEnum =
  | 'draft'
  | 'open'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type MembershipRoleEnum = 'member' | 'circle_admin';

export type MembershipStatusEnum =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'left'
  | 'removed';

export type ContributionStatusEnum =
  | 'pending'
  | 'paid'
  | 'late'
  | 'waived'
  | 'failed'
  | 'partial';

export type PayoutStatusEnum = 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled';

export type InvitationStatusEnum = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export type TransactionTypeEnum =
  | 'contribution'
  | 'payout'
  | 'wallet_top_up'
  | 'wallet_withdrawal'
  | 'fee'
  | 'adjustment';

export type TransactionStatusEnum =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed';

export type NotificationChannelEnum = 'in_app' | 'email' | 'sms' | 'push';

export type NotificationTypeEnum =
  | 'invitation'
  | 'contribution_due'
  | 'contribution_received'
  | 'payout_scheduled'
  | 'payout_paid'
  | 'kyc_update'
  | 'system'
  | 'admin';

export type AuditActionEnum =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'invite'
  | 'join'
  | 'leave'
  | 'approve'
  | 'reject'
  | 'export'
  | 'role_change';

export type KycDocumentTypeEnum =
  | 'national_id'
  | 'passport'
  | 'driving_license'
  | 'proof_of_address'
  | 'selfie'
  | 'other';

export type KycDocumentStatusEnum = 'uploaded' | 'under_review' | 'approved' | 'rejected';

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          bio: string | null;
          country_code: string | null;
          platform_role: PlatformRoleEnum;
          kyc_status: KycStatusEnum;
          profile_completed: boolean;
        } & Timestamps;
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          country_code?: string | null;
          platform_role?: PlatformRoleEnum;
          kyc_status?: KycStatusEnum;
          profile_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          country_code?: string | null;
          platform_role?: PlatformRoleEnum;
          kyc_status?: KycStatusEnum;
          profile_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jamiyas: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          status: JamiyaStatusEnum;
          created_by: string;
          contribution_amount: number;
          currency: string;
          max_members: number;
          cycle_count: number | null;
          contribution_frequency_days: number;
          current_cycle: number;
          member_count: number;
          start_date: string | null;
          end_date: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          status?: JamiyaStatusEnum;
          created_by: string;
          contribution_amount: number;
          currency?: string;
          max_members: number;
          cycle_count: number;
          contribution_frequency_days?: number;
          current_cycle?: number;
          member_count?: number;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          status?: JamiyaStatusEnum;
          created_by?: string;
          contribution_amount?: number;
          currency?: string;
          max_members?: number;
          cycle_count?: number | null;
          contribution_frequency_days?: number;
          current_cycle?: number;
          member_count?: number;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          jamiya_id: string;
          user_id: string;
          role: MembershipRoleEnum;
          status: MembershipStatusEnum;
          payout_position: number | null;
          joined_at: string | null;
          left_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          jamiya_id: string;
          user_id: string;
          role?: MembershipRoleEnum;
          status?: MembershipStatusEnum;
          payout_position?: number | null;
          joined_at?: string | null;
          left_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          jamiya_id?: string;
          user_id?: string;
          role?: MembershipRoleEnum;
          status?: MembershipStatusEnum;
          payout_position?: number | null;
          joined_at?: string | null;
          left_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          jamiya_id: string;
          invited_by: string;
          email: string | null;
          phone: string | null;
          invitee_user_id: string | null;
          token_hash: string;
          invite_code: string;
          status: InvitationStatusEnum;
          expires_at: string;
          accepted_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          jamiya_id: string;
          invited_by: string;
          email?: string | null;
          phone?: string | null;
          invitee_user_id?: string | null;
          token_hash: string;
          invite_code: string;
          status?: InvitationStatusEnum;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          jamiya_id?: string;
          invited_by?: string;
          email?: string | null;
          phone?: string | null;
          invitee_user_id?: string | null;
          token_hash?: string;
          invite_code?: string;
          status?: InvitationStatusEnum;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contributions: {
        Row: {
          id: string;
          jamiya_id: string;
          member_id: string;
          cycle_number: number;
          amount: number;
          currency: string;
          status: ContributionStatusEnum;
          due_date: string;
          paid_at: string | null;
          transaction_id: string | null;
          notes: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          jamiya_id: string;
          member_id: string;
          cycle_number: number;
          amount: number;
          currency: string;
          status?: ContributionStatusEnum;
          due_date: string;
          paid_at?: string | null;
          transaction_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          jamiya_id?: string;
          member_id?: string;
          cycle_number?: number;
          amount?: number;
          currency?: string;
          status?: ContributionStatusEnum;
          due_date?: string;
          paid_at?: string | null;
          transaction_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payouts: {
        Row: {
          id: string;
          jamiya_id: string;
          member_id: string;
          cycle_number: number;
          amount: number;
          currency: string;
          status: PayoutStatusEnum;
          scheduled_date: string;
          paid_at: string | null;
          transaction_id: string | null;
          notes: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          jamiya_id: string;
          member_id: string;
          cycle_number: number;
          amount: number;
          currency: string;
          status?: PayoutStatusEnum;
          scheduled_date: string;
          paid_at?: string | null;
          transaction_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          jamiya_id?: string;
          member_id?: string;
          cycle_number?: number;
          amount?: number;
          currency?: string;
          status?: PayoutStatusEnum;
          scheduled_date?: string;
          paid_at?: string | null;
          transaction_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          currency: string;
          balance: number;
          available_balance: number;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          currency?: string;
          balance?: number;
          available_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          currency?: string;
          balance?: number;
          available_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          wallet_id: string;
          user_id: string;
          jamiya_id: string | null;
          type: TransactionTypeEnum;
          status: TransactionStatusEnum;
          amount: number;
          currency: string;
          direction: 'debit' | 'credit';
          reference: string | null;
          idempotency_key: string | null;
          metadata: Json;
          processed_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          wallet_id: string;
          user_id: string;
          jamiya_id?: string | null;
          type: TransactionTypeEnum;
          status?: TransactionStatusEnum;
          amount: number;
          currency: string;
          direction: 'debit' | 'credit';
          reference?: string | null;
          idempotency_key?: string | null;
          metadata?: Json;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          user_id?: string;
          jamiya_id?: string | null;
          type?: TransactionTypeEnum;
          status?: TransactionStatusEnum;
          amount?: number;
          currency?: string;
          direction?: 'debit' | 'credit';
          reference?: string | null;
          idempotency_key?: string | null;
          metadata?: Json;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationTypeEnum;
          channel: NotificationChannelEnum;
          title: string;
          body: string;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationTypeEnum;
          channel?: NotificationChannelEnum;
          title: string;
          body: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationTypeEnum;
          channel?: NotificationChannelEnum;
          title?: string;
          body?: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      kyc_documents: {
        Row: {
          id: string;
          user_id: string;
          document_type: KycDocumentTypeEnum;
          status: KycDocumentStatusEnum;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          document_type: KycDocumentTypeEnum;
          status?: KycDocumentStatusEnum;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_type?: KycDocumentTypeEnum;
          status?: KycDocumentStatusEnum;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          file_size_bytes?: number;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: AuditActionEnum;
          entity_type: string;
          entity_id: string | null;
          jamiya_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: AuditActionEnum;
          entity_type: string;
          entity_id?: string | null;
          jamiya_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: AuditActionEnum;
          entity_type?: string;
          entity_id?: string | null;
          jamiya_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      preview_invitation: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      accept_invitation: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      decline_invitation: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      review_kyc_document: {
        Args: {
          p_document_id: string;
          p_decision: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      platform_role: PlatformRoleEnum;
      kyc_status: KycStatusEnum;
      jamiya_status: JamiyaStatusEnum;
      membership_role: MembershipRoleEnum;
      membership_status: MembershipStatusEnum;
      contribution_status: ContributionStatusEnum;
      payout_status: PayoutStatusEnum;
      invitation_status: InvitationStatusEnum;
      transaction_type: TransactionTypeEnum;
      transaction_status: TransactionStatusEnum;
      notification_channel: NotificationChannelEnum;
      notification_type: NotificationTypeEnum;
      audit_action: AuditActionEnum;
      kyc_document_type: KycDocumentTypeEnum;
      kyc_document_status: KycDocumentStatusEnum;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
