
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "adoption_impact_reports": {
                  Row: {
                    "adoption_profile_id": string,"body": string,"created_at": string,"created_by": string | null,"id": string,"period_label": string
                  }
                  Insert: {
                    "adoption_profile_id": string,"body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"period_label": string
                  }
                  Update: {
                    "adoption_profile_id"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"period_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adoption_impact_reports_adoption_profile_id_fkey"
      columns: ["adoption_profile_id"]
isOneToOne: false
      referencedRelation: "adoption_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adoption_impact_reports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"adoption_profiles": {
                  Row: {
                    "created_at": string,"currency": string,"description": string,"fee_bps": number,"id": string,"institution_id": string,"slug": string,"status": Database["public"]['Enums']["adoption_profile_status"],"suggested_monthly_amount": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"description": string,"fee_bps"?: number,"id"?: string,"institution_id": string,"slug": string,"status"?: Database["public"]['Enums']["adoption_profile_status"],"suggested_monthly_amount": number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"description"?: string,"fee_bps"?: number,"id"?: string,"institution_id"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["adoption_profile_status"],"suggested_monthly_amount"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adoption_profiles_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "sadaka_institutions"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string,"id": string,"jamiya_id": string,"title": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"created_by": string,"id"?: string,"jamiya_id": string,"title": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"jamiya_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": Database["public"]['Enums']["audit_action"],"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"ip_address": unknown,"jamiya_id": string | null,"metadata": NonNullable<Json>,"user_agent": string | null
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["audit_action"],"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"ip_address"?: unknown,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["audit_action"],"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"ip_address"?: unknown,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_logs_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"bank_transfer_jobs": {
                  Row: {
                    "account_name": string | null,"account_number": string | null,"amount": number,"bank_name": string | null,"created_at": string,"currency": string,"error_message": string | null,"id": string,"payment_intent_id": string | null,"provider_reference": string | null,"request_payload": NonNullable<Json>,"response_payload": NonNullable<Json>,"settled_at": string | null,"status": Database["public"]['Enums']["bank_transfer_status"],"submitted_at": string | null,"updated_at": string,"user_id": string,"withdrawal_id": string | null
                  }
                  Insert: {
                    "account_name"?: string | null,"account_number"?: string | null,"amount": number,"bank_name"?: string | null,"created_at"?: string,"currency"?: string,"error_message"?: string | null,"id"?: string,"payment_intent_id"?: string | null,"provider_reference"?: string | null,"request_payload"?: NonNullable<Json>,"response_payload"?: NonNullable<Json>,"settled_at"?: string | null,"status"?: Database["public"]['Enums']["bank_transfer_status"],"submitted_at"?: string | null,"updated_at"?: string,"user_id": string,"withdrawal_id"?: string | null
                  }
                  Update: {
                    "account_name"?: string | null,"account_number"?: string | null,"amount"?: number,"bank_name"?: string | null,"created_at"?: string,"currency"?: string,"error_message"?: string | null,"id"?: string,"payment_intent_id"?: string | null,"provider_reference"?: string | null,"request_payload"?: NonNullable<Json>,"response_payload"?: NonNullable<Json>,"settled_at"?: string | null,"status"?: Database["public"]['Enums']["bank_transfer_status"],"submitted_at"?: string | null,"updated_at"?: string,"user_id"?: string,"withdrawal_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bank_transfer_jobs_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transfer_jobs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bank_transfer_jobs_withdrawal_id_fkey"
      columns: ["withdrawal_id"]
isOneToOne: false
      referencedRelation: "withdrawal_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"book_entries": {
                  Row: {
                    "amount": number,"bank_account_id": string | null,"category_id": string | null,"counterparty_account_id": string | null,"created_at": string,"currency": string,"effective_date": string,"entered_at": string,"entered_by": string,"entry_type": string,"id": string,"investment_id": string | null,"jamiya_id": string,"member_id": string | null,"metadata": NonNullable<Json>,"notes": string | null
                  }
                  Insert: {
                    "amount": number,"bank_account_id"?: string | null,"category_id"?: string | null,"counterparty_account_id"?: string | null,"created_at"?: string,"currency"?: string,"effective_date": string,"entered_at"?: string,"entered_by": string,"entry_type": string,"id"?: string,"investment_id"?: string | null,"jamiya_id": string,"member_id"?: string | null,"metadata"?: NonNullable<Json>,"notes"?: string | null
                  }
                  Update: {
                    "amount"?: number,"bank_account_id"?: string | null,"category_id"?: string | null,"counterparty_account_id"?: string | null,"created_at"?: string,"currency"?: string,"effective_date"?: string,"entered_at"?: string,"entered_by"?: string,"entry_type"?: string,"id"?: string,"investment_id"?: string | null,"jamiya_id"?: string,"member_id"?: string | null,"metadata"?: NonNullable<Json>,"notes"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_entries_bank_account_id_fkey"
      columns: ["bank_account_id"]
isOneToOne: false
      referencedRelation: "circle_bank_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_entries_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "circle_ledger_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_entries_counterparty_account_id_fkey"
      columns: ["counterparty_account_id"]
isOneToOne: false
      referencedRelation: "circle_bank_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_entries_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_entries_investment_id_fkey"
      columns: ["investment_id"]
isOneToOne: false
      referencedRelation: "circle_investments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_entries_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_entries_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"charity_campaigns": {
                  Row: {
                    "auto_disburse": boolean,"beneficiary_kyc_doc_url": string | null,"beneficiary_name": string | null,"beneficiary_phone": string | null,"category": Database["public"]['Enums']["sadaka_category"] | null,"cover_image_url": string | null,"created_at": string,"created_by": string | null,"currency": string,"custody_mode": string,"description": string | null,"disbursed_amount": number,"ends_at": string | null,"fee_bps": number,"fee_mode": Database["public"]['Enums']["fee_mode"],"goal_amount": number,"id": string,"last_disbursed_at": string | null,"psp_provider": string | null,"psp_subaccount_ref": string | null,"public_media_urls": (string)[],"raised_amount": number,"rejection_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"sharia_board_endorsed": boolean,"slug": string,"starts_at": string | null,"status": Database["public"]['Enums']["campaign_status"],"summary": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "auto_disburse"?: boolean,"beneficiary_kyc_doc_url"?: string | null,"beneficiary_name"?: string | null,"beneficiary_phone"?: string | null,"category"?: Database["public"]['Enums']["sadaka_category"] | null,"cover_image_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"custody_mode"?: string,"description"?: string | null,"disbursed_amount"?: number,"ends_at"?: string | null,"fee_bps"?: number,"fee_mode"?: Database["public"]['Enums']["fee_mode"],"goal_amount": number,"id"?: string,"last_disbursed_at"?: string | null,"psp_provider"?: string | null,"psp_subaccount_ref"?: string | null,"public_media_urls"?: (string)[],"raised_amount"?: number,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"sharia_board_endorsed"?: boolean,"slug": string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["campaign_status"],"summary": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "auto_disburse"?: boolean,"beneficiary_kyc_doc_url"?: string | null,"beneficiary_name"?: string | null,"beneficiary_phone"?: string | null,"category"?: Database["public"]['Enums']["sadaka_category"] | null,"cover_image_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"custody_mode"?: string,"description"?: string | null,"disbursed_amount"?: number,"ends_at"?: string | null,"fee_bps"?: number,"fee_mode"?: Database["public"]['Enums']["fee_mode"],"goal_amount"?: number,"id"?: string,"last_disbursed_at"?: string | null,"psp_provider"?: string | null,"psp_subaccount_ref"?: string | null,"public_media_urls"?: (string)[],"raised_amount"?: number,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"sharia_board_endorsed"?: boolean,"slug"?: string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["campaign_status"],"summary"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "charity_campaigns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charity_campaigns_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"charity_disbursements": {
                  Row: {
                    "amount": number,"approved_by": string | null,"beneficiary_phone": string,"campaign_id": string,"created_at": string,"currency": string,"fee_deducted": number,"id": string,"mpesa_b2c_id": string | null,"net_amount": number,"notes": string | null,"paid_at": string | null,"status": Database["public"]['Enums']["disbursement_status"]
                  }
                  Insert: {
                    "amount": number,"approved_by"?: string | null,"beneficiary_phone": string,"campaign_id": string,"created_at"?: string,"currency"?: string,"fee_deducted"?: number,"id"?: string,"mpesa_b2c_id"?: string | null,"net_amount": number,"notes"?: string | null,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["disbursement_status"]
                  }
                  Update: {
                    "amount"?: number,"approved_by"?: string | null,"beneficiary_phone"?: string,"campaign_id"?: string,"created_at"?: string,"currency"?: string,"fee_deducted"?: number,"id"?: string,"mpesa_b2c_id"?: string | null,"net_amount"?: number,"notes"?: string | null,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["disbursement_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "charity_disbursements_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charity_disbursements_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "charity_campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"charity_donations": {
                  Row: {
                    "amount": number,"campaign_id": string,"created_at": string,"currency": string,"donor_email": string | null,"donor_name": string | null,"donor_phone": string | null,"donor_user_id": string | null,"fee_amount": number,"id": string,"is_anonymous": boolean,"metadata": NonNullable<Json>,"payment_intent_id": string | null,"receipt_code": string
                  }
                  Insert: {
                    "amount": number,"campaign_id": string,"created_at"?: string,"currency"?: string,"donor_email"?: string | null,"donor_name"?: string | null,"donor_phone"?: string | null,"donor_user_id"?: string | null,"fee_amount"?: number,"id"?: string,"is_anonymous"?: boolean,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"receipt_code": string
                  }
                  Update: {
                    "amount"?: number,"campaign_id"?: string,"created_at"?: string,"currency"?: string,"donor_email"?: string | null,"donor_name"?: string | null,"donor_phone"?: string | null,"donor_user_id"?: string | null,"fee_amount"?: number,"id"?: string,"is_anonymous"?: boolean,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"receipt_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "charity_donations_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "charity_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charity_donations_donor_user_id_fkey"
      columns: ["donor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charity_donations_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_bank_accounts": {
                  Row: {
                    "account_kind": string,"account_number": string | null,"balance": number,"created_at": string,"currency": string,"id": string,"is_active": boolean,"jamiya_id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "account_kind"?: string,"account_number"?: string | null,"balance"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"is_active"?: boolean,"jamiya_id": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "account_kind"?: string,"account_number"?: string | null,"balance"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"is_active"?: boolean,"jamiya_id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_bank_accounts_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_bank_alerts": {
                  Row: {
                    "alert_text": string | null,"amount": number | null,"bank_account_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"direction": string | null,"external_ref": string | null,"id": string,"jamiya_id": string,"matched_book_entry_id": string | null,"occurred_at": string | null,"provider": string,"status": string
                  }
                  Insert: {
                    "alert_text"?: string | null,"amount"?: number | null,"bank_account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"direction"?: string | null,"external_ref"?: string | null,"id"?: string,"jamiya_id": string,"matched_book_entry_id"?: string | null,"occurred_at"?: string | null,"provider"?: string,"status"?: string
                  }
                  Update: {
                    "alert_text"?: string | null,"amount"?: number | null,"bank_account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"direction"?: string | null,"external_ref"?: string | null,"id"?: string,"jamiya_id"?: string,"matched_book_entry_id"?: string | null,"occurred_at"?: string | null,"provider"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_bank_alerts_bank_account_id_fkey"
      columns: ["bank_account_id"]
isOneToOne: false
      referencedRelation: "circle_bank_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_bank_alerts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_bank_alerts_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_bank_alerts_matched_book_entry_id_fkey"
      columns: ["matched_book_entry_id"]
isOneToOne: false
      referencedRelation: "book_entries"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_contribution_invoices": {
                  Row: {
                    "amount_due": number,"contribution_id": string,"created_at": string,"currency": string,"due_date": string | null,"id": string,"invoice_number": string,"issued_at": string,"jamiya_id": string,"member_id": string,"notes": string | null,"paid_at": string | null,"reminded_at": string | null,"status": string,"user_id": string
                  }
                  Insert: {
                    "amount_due": number,"contribution_id": string,"created_at"?: string,"currency"?: string,"due_date"?: string | null,"id"?: string,"invoice_number": string,"issued_at"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"paid_at"?: string | null,"reminded_at"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "amount_due"?: number,"contribution_id"?: string,"created_at"?: string,"currency"?: string,"due_date"?: string | null,"id"?: string,"invoice_number"?: string,"issued_at"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"paid_at"?: string | null,"reminded_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_contribution_invoices_contribution_id_fkey"
      columns: ["contribution_id"]
isOneToOne: true
      referencedRelation: "contributions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_contribution_invoices_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_contribution_invoices_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_contribution_invoices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_dividend_allocations": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"dividend_id": string,"id": string,"jamiya_id": string,"member_id": string,"shares_basis": number,"status": string
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"currency"?: string,"dividend_id": string,"id"?: string,"jamiya_id": string,"member_id": string,"shares_basis"?: number,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"dividend_id"?: string,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"shares_basis"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_dividend_allocations_dividend_id_fkey"
      columns: ["dividend_id"]
isOneToOne: false
      referencedRelation: "circle_dividends"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_dividend_allocations_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_dividend_allocations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_dividends": {
                  Row: {
                    "created_at": string,"currency": string,"declared_at": string,"declared_by": string | null,"id": string,"jamiya_id": string,"label": string,"notes": string | null,"period_end": string | null,"period_start": string | null,"status": string,"total_amount": number
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"declared_at"?: string,"declared_by"?: string | null,"id"?: string,"jamiya_id": string,"label": string,"notes"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: string,"total_amount": number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"declared_at"?: string,"declared_by"?: string | null,"id"?: string,"jamiya_id"?: string,"label"?: string,"notes"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"status"?: string,"total_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_dividends_declared_by_fkey"
      columns: ["declared_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_dividends_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_election_candidates": {
                  Row: {
                    "created_at": string,"election_id": string,"id": string,"member_id": string,"nominated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"election_id": string,"id"?: string,"member_id": string,"nominated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"election_id"?: string,"id"?: string,"member_id"?: string,"nominated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_election_candidates_election_id_fkey"
      columns: ["election_id"]
isOneToOne: false
      referencedRelation: "circle_elections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_election_candidates_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_election_candidates_nominated_by_fkey"
      columns: ["nominated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_elections": {
                  Row: {
                    "closes_at": string | null,"created_at": string,"created_by": string,"id": string,"jamiya_id": string,"opens_at": string,"seat_role": string,"status": Database["public"]['Enums']["election_status"],"title": string,"updated_at": string,"winner_member_id": string | null
                  }
                  Insert: {
                    "closes_at"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"jamiya_id": string,"opens_at"?: string,"seat_role": string,"status"?: Database["public"]['Enums']["election_status"],"title": string,"updated_at"?: string,"winner_member_id"?: string | null
                  }
                  Update: {
                    "closes_at"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"jamiya_id"?: string,"opens_at"?: string,"seat_role"?: string,"status"?: Database["public"]['Enums']["election_status"],"title"?: string,"updated_at"?: string,"winner_member_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_elections_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_elections_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_elections_winner_member_id_fkey"
      columns: ["winner_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_investments": {
                  Row: {
                    "closed_on": string | null,"created_at": string,"created_by": string | null,"currency": string,"current_value": number,"description": string | null,"id": string,"jamiya_id": string,"name": string,"notes": string | null,"principal": number,"started_on": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "closed_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"current_value"?: number,"description"?: string | null,"id"?: string,"jamiya_id": string,"name": string,"notes"?: string | null,"principal"?: number,"started_on"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "closed_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"current_value"?: number,"description"?: string | null,"id"?: string,"jamiya_id"?: string,"name"?: string,"notes"?: string | null,"principal"?: number,"started_on"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_investments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_investments_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_ledger_categories": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"jamiya_id": string,"kind": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"jamiya_id": string,"kind": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"jamiya_id"?: string,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_ledger_categories_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_meetings": {
                  Row: {
                    "created_at": string,"created_by": string,"ends_at": string | null,"id": string,"jamiya_id": string,"location": string | null,"notes": string | null,"starts_at": string,"status": Database["public"]['Enums']["meeting_status"],"title": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"ends_at"?: string | null,"id"?: string,"jamiya_id": string,"location"?: string | null,"notes"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["meeting_status"],"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"ends_at"?: string | null,"id"?: string,"jamiya_id"?: string,"location"?: string | null,"notes"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["meeting_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_meetings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_meetings_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"jamiya_id": string,"sender_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"jamiya_id": string,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"jamiya_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_messages_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_payout_destinations": {
                  Row: {
                    "account_reference": string | null,"bank_account_name": string | null,"bank_account_number": string | null,"bank_name": string | null,"created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"jamiya_id": string,"kind": string,"label": string,"shortcode": string | null,"updated_at": string
                  }
                  Insert: {
                    "account_reference"?: string | null,"bank_account_name"?: string | null,"bank_account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"jamiya_id": string,"kind": string,"label": string,"shortcode"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "account_reference"?: string | null,"bank_account_name"?: string | null,"bank_account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"jamiya_id"?: string,"kind"?: string,"label"?: string,"shortcode"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_payout_destinations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_payout_destinations_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_share_lots": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"id": string,"jamiya_id": string,"member_id": string,"notes": string | null,"purchased_on": string,"recorded_by": string | null,"shares": number,"unit_price": number
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"currency"?: string,"id"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"purchased_on"?: string,"recorded_by"?: string | null,"shares": number,"unit_price": number
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"purchased_on"?: string,"recorded_by"?: string | null,"shares"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_share_lots_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_share_lots_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_share_lots_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_subscriptions": {
                  Row: {
                    "jamiya_id": string,"notes": string | null,"plan_id": string,"renews_at": string | null,"started_at": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "jamiya_id": string,"notes"?: string | null,"plan_id": string,"renews_at"?: string | null,"started_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "jamiya_id"?: string,"notes"?: string | null,"plan_id"?: string,"renews_at"?: string | null,"started_at"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_subscriptions_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: true
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "platform_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_votes": {
                  Row: {
                    "candidate_id": string,"created_at": string,"election_id": string,"id": string,"voter_member_id": string
                  }
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"election_id": string,"id"?: string,"voter_member_id": string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"election_id"?: string,"id"?: string,"voter_member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_votes_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "circle_election_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_votes_election_id_fkey"
      columns: ["election_id"]
isOneToOne: false
      referencedRelation: "circle_elections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_votes_voter_member_id_fkey"
      columns: ["voter_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_case_actions": {
                  Row: {
                    "action": string,"actor_id": string | null,"case_id": string,"channel": Database["public"]['Enums']["playbook_channel"] | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"notes": string | null,"playbook_id": string | null,"step_id": string | null
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"case_id": string,"channel"?: Database["public"]['Enums']["playbook_channel"] | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"notes"?: string | null,"playbook_id"?: string | null,"step_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"case_id"?: string,"channel"?: Database["public"]['Enums']["playbook_channel"] | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"notes"?: string | null,"playbook_id"?: string | null,"step_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_case_actions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_case_actions_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "collection_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_case_actions_playbook_id_fkey"
      columns: ["playbook_id"]
isOneToOne: false
      referencedRelation: "collection_playbooks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_case_actions_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "collection_playbook_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_cases": {
                  Row: {
                    "amount_due": number,"assigned_to": string | null,"contact_attempts": number,"contribution_id": string | null,"created_at": string,"currency": string,"days_overdue": number,"id": string,"jamiya_id": string,"last_contacted_at": string | null,"member_id": string,"metadata": NonNullable<Json>,"notes": string | null,"promised_pay_date": string | null,"resolved_at": string | null,"severity": Database["public"]['Enums']["collection_severity"],"status": Database["public"]['Enums']["collection_status"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount_due": number,"assigned_to"?: string | null,"contact_attempts"?: number,"contribution_id"?: string | null,"created_at"?: string,"currency"?: string,"days_overdue"?: number,"id"?: string,"jamiya_id": string,"last_contacted_at"?: string | null,"member_id": string,"metadata"?: NonNullable<Json>,"notes"?: string | null,"promised_pay_date"?: string | null,"resolved_at"?: string | null,"severity"?: Database["public"]['Enums']["collection_severity"],"status"?: Database["public"]['Enums']["collection_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_due"?: number,"assigned_to"?: string | null,"contact_attempts"?: number,"contribution_id"?: string | null,"created_at"?: string,"currency"?: string,"days_overdue"?: number,"id"?: string,"jamiya_id"?: string,"last_contacted_at"?: string | null,"member_id"?: string,"metadata"?: NonNullable<Json>,"notes"?: string | null,"promised_pay_date"?: string | null,"resolved_at"?: string | null,"severity"?: Database["public"]['Enums']["collection_severity"],"status"?: Database["public"]['Enums']["collection_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_cases_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_cases_contribution_id_fkey"
      columns: ["contribution_id"]
isOneToOne: false
      referencedRelation: "contributions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_cases_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_cases_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_cases_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_playbook_steps": {
                  Row: {
                    "channel": Database["public"]['Enums']["playbook_channel"],"create_agent_task": boolean,"created_at": string,"delay_hours": number,"id": string,"metadata": NonNullable<Json>,"playbook_id": string,"step_order": number,"template_body": string,"template_subject": string | null
                  }
                  Insert: {
                    "channel": Database["public"]['Enums']["playbook_channel"],"create_agent_task"?: boolean,"created_at"?: string,"delay_hours"?: number,"id"?: string,"metadata"?: NonNullable<Json>,"playbook_id": string,"step_order": number,"template_body": string,"template_subject"?: string | null
                  }
                  Update: {
                    "channel"?: Database["public"]['Enums']["playbook_channel"],"create_agent_task"?: boolean,"created_at"?: string,"delay_hours"?: number,"id"?: string,"metadata"?: NonNullable<Json>,"playbook_id"?: string,"step_order"?: number,"template_body"?: string,"template_subject"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_playbook_steps_playbook_id_fkey"
      columns: ["playbook_id"]
isOneToOne: false
      referencedRelation: "collection_playbooks"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_playbooks": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"max_days_overdue": number | null,"metadata": NonNullable<Json>,"min_days_overdue": number,"name": string,"priority": number,"severity": Database["public"]['Enums']["collection_severity"] | null,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"max_days_overdue"?: number | null,"metadata"?: NonNullable<Json>,"min_days_overdue"?: number,"name": string,"priority"?: number,"severity"?: Database["public"]['Enums']["collection_severity"] | null,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"max_days_overdue"?: number | null,"metadata"?: NonNullable<Json>,"min_days_overdue"?: number,"name"?: string,"priority"?: number,"severity"?: Database["public"]['Enums']["collection_severity"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contribution_payments": {
                  Row: {
                    "amount": number,"contribution_id": string,"created_at": string,"created_by": string,"currency": string,"id": string,"notes": string | null,"paid_at": string,"payment_method": string,"transaction_id": string | null
                  }
                  Insert: {
                    "amount": number,"contribution_id": string,"created_at"?: string,"created_by": string,"currency": string,"id"?: string,"notes"?: string | null,"paid_at"?: string,"payment_method"?: string,"transaction_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"contribution_id"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"id"?: string,"notes"?: string | null,"paid_at"?: string,"payment_method"?: string,"transaction_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contribution_payments_contribution_id_fkey"
      columns: ["contribution_id"]
isOneToOne: false
      referencedRelation: "contributions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contribution_payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contribution_payments_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"contributions": {
                  Row: {
                    "amount": number,"amount_paid": number,"created_at": string,"currency": string,"cycle_number": number,"due_date": string,"id": string,"jamiya_id": string,"member_id": string,"notes": string | null,"paid_at": string | null,"status": Database["public"]['Enums']["contribution_status"],"transaction_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"amount_paid"?: number,"created_at"?: string,"currency": string,"cycle_number": number,"due_date": string,"id"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["contribution_status"],"transaction_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"amount_paid"?: number,"created_at"?: string,"currency"?: string,"cycle_number"?: number,"due_date"?: string,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["contribution_status"],"transaction_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contributions_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"device_push_tokens": {
                  Row: {
                    "created_at": string,"id": string,"platform": string,"token": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"platform"?: string,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"platform"?: string,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "against_user_id": string | null,"created_at": string,"description": string,"id": string,"jamiya_id": string,"metadata": NonNullable<Json>,"opened_by": string,"resolution_notes": string | null,"resolved_at": string | null,"resolved_by": string | null,"risk_score": number,"status": Database["public"]['Enums']["dispute_status"],"title": string,"type": Database["public"]['Enums']["dispute_type"],"updated_at": string
                  }
                  Insert: {
                    "against_user_id"?: string | null,"created_at"?: string,"description": string,"id"?: string,"jamiya_id": string,"metadata"?: NonNullable<Json>,"opened_by": string,"resolution_notes"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"risk_score"?: number,"status"?: Database["public"]['Enums']["dispute_status"],"title": string,"type"?: Database["public"]['Enums']["dispute_type"],"updated_at"?: string
                  }
                  Update: {
                    "against_user_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"jamiya_id"?: string,"metadata"?: NonNullable<Json>,"opened_by"?: string,"resolution_notes"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"risk_score"?: number,"status"?: Database["public"]['Enums']["dispute_status"],"title"?: string,"type"?: Database["public"]['Enums']["dispute_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_against_user_id_fkey"
      columns: ["against_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dual_approval_requests": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"entity_id": string,"first_approver_id": string | null,"id": string,"jamiya_id": string | null,"kind": string,"payload": NonNullable<Json>,"requested_by": string,"result": Json | null,"second_approver_id": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"entity_id": string,"first_approver_id"?: string | null,"id"?: string,"jamiya_id"?: string | null,"kind": string,"payload"?: NonNullable<Json>,"requested_by": string,"result"?: Json | null,"second_approver_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"entity_id"?: string,"first_approver_id"?: string | null,"id"?: string,"jamiya_id"?: string | null,"kind"?: string,"payload"?: NonNullable<Json>,"requested_by"?: string,"result"?: Json | null,"second_approver_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dual_approval_requests_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"fine_categories": {
                  Row: {
                    "created_at": string,"currency": string,"default_amount": number,"id": string,"is_active": boolean,"jamiya_id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"default_amount"?: number,"id"?: string,"is_active"?: boolean,"jamiya_id": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"default_amount"?: number,"id"?: string,"is_active"?: boolean,"jamiya_id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fine_categories_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"grace_period_requests": {
                  Row: {
                    "contribution_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"jamiya_id": string,"new_due_date": string | null,"reason": string | null,"requested_days": number,"requester_id": string,"status": Database["public"]['Enums']["grace_request_status"]
                  }
                  Insert: {
                    "contribution_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"jamiya_id": string,"new_due_date"?: string | null,"reason"?: string | null,"requested_days": number,"requester_id": string,"status"?: Database["public"]['Enums']["grace_request_status"]
                  }
                  Update: {
                    "contribution_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"jamiya_id"?: string,"new_due_date"?: string | null,"reason"?: string | null,"requested_days"?: number,"requester_id"?: string,"status"?: Database["public"]['Enums']["grace_request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "grace_period_requests_contribution_id_fkey"
      columns: ["contribution_id"]
isOneToOne: false
      referencedRelation: "contributions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grace_period_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grace_period_requests_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grace_period_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string | null,"expires_at": string,"id": string,"invite_code": string,"invited_by": string,"invitee_user_id": string | null,"is_share_link": boolean,"jamiya_id": string,"phone": string | null,"status": Database["public"]['Enums']["invitation_status"],"token_hash": string,"updated_at": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at": string,"id"?: string,"invite_code"?: string,"invited_by": string,"invitee_user_id"?: string | null,"is_share_link"?: boolean,"jamiya_id": string,"phone"?: string | null,"status"?: Database["public"]['Enums']["invitation_status"],"token_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"invite_code"?: string,"invited_by"?: string,"invitee_user_id"?: string | null,"is_share_link"?: boolean,"jamiya_id"?: string,"phone"?: string | null,"status"?: Database["public"]['Enums']["invitation_status"],"token_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_invitee_user_id_fkey"
      columns: ["invitee_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"iprs_verifications": {
                  Row: {
                    "created_at": string,"date_of_birth": string | null,"first_name": string,"id": string,"last_name": string,"matched": boolean,"national_id": string,"outcome": string,"provider": string,"response": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"date_of_birth"?: string | null,"first_name": string,"id"?: string,"last_name": string,"matched"?: boolean,"national_id": string,"outcome": string,"provider": string,"response"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"date_of_birth"?: string | null,"first_name"?: string,"id"?: string,"last_name"?: string,"matched"?: boolean,"national_id"?: string,"outcome"?: string,"provider"?: string,"response"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iprs_verifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"jamiya_kyc_documents": {
                  Row: {
                    "created_at": string,"document_type": string,"file_name": string,"file_size_bytes": number | null,"id": string,"jamiya_id": string,"mime_type": string | null,"review_notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"storage_path": string,"updated_at": string,"uploaded_by": string
                  }
                  Insert: {
                    "created_at"?: string,"document_type": string,"file_name": string,"file_size_bytes"?: number | null,"id"?: string,"jamiya_id": string,"mime_type"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"storage_path": string,"updated_at"?: string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"document_type"?: string,"file_name"?: string,"file_size_bytes"?: number | null,"id"?: string,"jamiya_id"?: string,"mime_type"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"storage_path"?: string,"updated_at"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jamiya_kyc_documents_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jamiya_kyc_documents_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jamiya_kyc_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"jamiyas": {
                  Row: {
                    "auto_fine_enabled": boolean,"auto_fine_grace_days": number,"challenge_kind": string,"contribution_amount": number,"contribution_frequency_days": number,"created_at": string,"created_by": string,"currency": string,"current_cycle": number,"cycle_count": number | null,"description": string | null,"dual_approval_enabled": boolean,"dual_approval_threshold": number,"early_slot_fee_pct": number,"end_date": string | null,"gatekeeper_label": string | null,"grace_period_days": number,"id": string,"join_fee_amount": number,"late_contribution_penalty": number,"late_loan_penalty_fixed": number,"late_loan_penalty_pct": number,"late_slot_rebate_pct": number,"loan_profit_rate_pct": number | null,"max_members": number,"member_count": number,"missed_contribution_penalty": number,"name": string,"payout_compliance_mode": string,"registration_number": string | null,"registration_status": string,"segment": Database["public"]['Enums']["circle_segment"],"share_currency": string,"share_par_value": number,"slot_pricing_enabled": boolean,"slug": string,"start_date": string | null,"status": Database["public"]['Enums']["jamiya_status"],"transaction_fee_amount": number,"updated_at": string
                  }
                  Insert: {
                    "auto_fine_enabled"?: boolean,"auto_fine_grace_days"?: number,"challenge_kind"?: string,"contribution_amount": number,"contribution_frequency_days"?: number,"created_at"?: string,"created_by": string,"currency"?: string,"current_cycle"?: number,"cycle_count"?: number | null,"description"?: string | null,"dual_approval_enabled"?: boolean,"dual_approval_threshold"?: number,"early_slot_fee_pct"?: number,"end_date"?: string | null,"gatekeeper_label"?: string | null,"grace_period_days"?: number,"id"?: string,"join_fee_amount"?: number,"late_contribution_penalty"?: number,"late_loan_penalty_fixed"?: number,"late_loan_penalty_pct"?: number,"late_slot_rebate_pct"?: number,"loan_profit_rate_pct"?: number | null,"max_members": number,"member_count"?: number,"missed_contribution_penalty"?: number,"name": string,"payout_compliance_mode"?: string,"registration_number"?: string | null,"registration_status"?: string,"segment"?: Database["public"]['Enums']["circle_segment"],"share_currency"?: string,"share_par_value"?: number,"slot_pricing_enabled"?: boolean,"slug": string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["jamiya_status"],"transaction_fee_amount"?: number,"updated_at"?: string
                  }
                  Update: {
                    "auto_fine_enabled"?: boolean,"auto_fine_grace_days"?: number,"challenge_kind"?: string,"contribution_amount"?: number,"contribution_frequency_days"?: number,"created_at"?: string,"created_by"?: string,"currency"?: string,"current_cycle"?: number,"cycle_count"?: number | null,"description"?: string | null,"dual_approval_enabled"?: boolean,"dual_approval_threshold"?: number,"early_slot_fee_pct"?: number,"end_date"?: string | null,"gatekeeper_label"?: string | null,"grace_period_days"?: number,"id"?: string,"join_fee_amount"?: number,"late_contribution_penalty"?: number,"late_loan_penalty_fixed"?: number,"late_loan_penalty_pct"?: number,"late_slot_rebate_pct"?: number,"loan_profit_rate_pct"?: number | null,"max_members"?: number,"member_count"?: number,"missed_contribution_penalty"?: number,"name"?: string,"payout_compliance_mode"?: string,"registration_number"?: string | null,"registration_status"?: string,"segment"?: Database["public"]['Enums']["circle_segment"],"share_currency"?: string,"share_par_value"?: number,"slot_pricing_enabled"?: boolean,"slug"?: string,"start_date"?: string | null,"status"?: Database["public"]['Enums']["jamiya_status"],"transaction_fee_amount"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jamiyas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"journal_entries": {
                  Row: {
                    "created_at": string,"currency": string,"description": string | null,"domain": string,"id": string,"jamiya_id": string | null,"metadata": NonNullable<Json>,"payment_intent_id": string | null,"posted_at": string,"source_id": string,"source_type": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"description"?: string | null,"domain": string,"id"?: string,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"posted_at"?: string,"source_id": string,"source_type": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"description"?: string | null,"domain"?: string,"id"?: string,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"posted_at"?: string,"source_id"?: string,"source_type"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_entries_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"journal_lines": {
                  Row: {
                    "amount": number,"amount_minor": number,"created_at": string,"currency": string,"id": string,"journal_entry_id": string,"ledger_account_id": string,"memo": string | null,"side": string
                  }
                  Insert: {
                    "amount": number,"amount_minor": number,"created_at"?: string,"currency"?: string,"id"?: string,"journal_entry_id": string,"ledger_account_id": string,"memo"?: string | null,"side": string
                  }
                  Update: {
                    "amount"?: number,"amount_minor"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"journal_entry_id"?: string,"ledger_account_id"?: string,"memo"?: string | null,"side"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_lines_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_lines_ledger_account_id_fkey"
      columns: ["ledger_account_id"]
isOneToOne: false
      referencedRelation: "ledger_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"kyc_documents": {
                  Row: {
                    "created_at": string,"document_type": Database["public"]['Enums']["kyc_document_type"],"file_name": string,"file_size_bytes": number,"id": string,"mime_type": string,"rejection_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["kyc_document_status"],"storage_path": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"document_type": Database["public"]['Enums']["kyc_document_type"],"file_name": string,"file_size_bytes": number,"id"?: string,"mime_type": string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["kyc_document_status"],"storage_path": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"document_type"?: Database["public"]['Enums']["kyc_document_type"],"file_name"?: string,"file_size_bytes"?: number,"id"?: string,"mime_type"?: string,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["kyc_document_status"],"storage_path"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kyc_documents_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kyc_documents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ledger_accounts": {
                  Row: {
                    "code": string,"created_at": string,"currency": string,"domain": string,"id": string,"is_active": boolean,"metadata": NonNullable<Json>,"name": string,"normal_balance": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"currency"?: string,"domain": string,"id"?: string,"is_active"?: boolean,"metadata"?: NonNullable<Json>,"name": string,"normal_balance": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"currency"?: string,"domain"?: string,"id"?: string,"is_active"?: boolean,"metadata"?: NonNullable<Json>,"name"?: string,"normal_balance"?: string
                  }
                  Relationships: [
                    
                  ]
                },"member_loan_events": {
                  Row: {
                    "amount": number,"book_entry_id": string | null,"created_at": string,"effective_date": string,"entered_by": string,"event_type": string,"facility_id": string,"id": string,"jamiya_id": string,"member_id": string,"metadata": NonNullable<Json>,"notes": string | null,"principal_delta": number,"profit_amount": number
                  }
                  Insert: {
                    "amount": number,"book_entry_id"?: string | null,"created_at"?: string,"effective_date": string,"entered_by": string,"event_type": string,"facility_id": string,"id"?: string,"jamiya_id": string,"member_id": string,"metadata"?: NonNullable<Json>,"notes"?: string | null,"principal_delta"?: number,"profit_amount"?: number
                  }
                  Update: {
                    "amount"?: number,"book_entry_id"?: string | null,"created_at"?: string,"effective_date"?: string,"entered_by"?: string,"event_type"?: string,"facility_id"?: string,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"metadata"?: NonNullable<Json>,"notes"?: string | null,"principal_delta"?: number,"profit_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_loan_events_book_entry_id_fkey"
      columns: ["book_entry_id"]
isOneToOne: false
      referencedRelation: "book_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_loan_events_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_loan_events_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "member_loan_facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_loan_events_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_loan_events_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"member_loan_facilities": {
                  Row: {
                    "closed_on": string | null,"created_at": string,"currency": string,"id": string,"jamiya_id": string,"member_id": string,"notes": string | null,"opened_on": string,"principal_outstanding": number,"profit_rate_pct": number | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "closed_on"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"opened_on": string,"principal_outstanding"?: number,"profit_rate_pct"?: number | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "closed_on"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"opened_on"?: string,"principal_outstanding"?: number,"profit_rate_pct"?: number | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_loan_facilities_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_loan_facilities_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"member_next_of_kin": {
                  Row: {
                    "created_at": string,"created_by": string | null,"full_name": string,"id": string,"jamiya_id": string,"member_id": string,"notes": string | null,"phone": string | null,"relationship": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"full_name": string,"id"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"phone"?: string | null,"relationship"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"full_name"?: string,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"phone"?: string | null,"relationship"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_next_of_kin_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_next_of_kin_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_next_of_kin_member_id_fkey"
      columns: ["member_id"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"member_risk_scores": {
                  Row: {
                    "band": Database["public"]['Enums']["risk_band"],"computed_at": string,"factors": NonNullable<Json>,"failed_payments": number,"late_contributions": number,"open_disputes": number,"score": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "band"?: Database["public"]['Enums']["risk_band"],"computed_at"?: string,"factors"?: NonNullable<Json>,"failed_payments"?: number,"late_contributions"?: number,"open_disputes"?: number,"score"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "band"?: Database["public"]['Enums']["risk_band"],"computed_at"?: string,"factors"?: NonNullable<Json>,"failed_payments"?: number,"late_contributions"?: number,"open_disputes"?: number,"score"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_risk_scores_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"member_vouches": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"id": string,"jamiya_id": string,"member_id": string,"notes": string | null,"status": Database["public"]['Enums']["vouch_status"],"voucher_user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"id"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"status"?: Database["public"]['Enums']["vouch_status"],"voucher_user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["vouch_status"],"voucher_user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_vouches_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_vouches_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_vouches_voucher_user_id_fkey"
      columns: ["voucher_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"id": string,"jamiya_id": string,"joined_at": string | null,"left_at": string | null,"member_code": string | null,"payout_position": number | null,"role": Database["public"]['Enums']["membership_role"],"status": Database["public"]['Enums']["membership_status"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"jamiya_id": string,"joined_at"?: string | null,"left_at"?: string | null,"member_code"?: string | null,"payout_position"?: number | null,"role"?: Database["public"]['Enums']["membership_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"jamiya_id"?: string,"joined_at"?: string | null,"left_at"?: string | null,"member_code"?: string | null,"payout_position"?: number | null,"role"?: Database["public"]['Enums']["membership_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"body": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"id": string,"last_error": string | null,"metadata": NonNullable<Json>,"notification_id": string | null,"recipient": string,"scheduled_at": string,"sent_at": string | null,"status": Database["public"]['Enums']["delivery_status"],"subject": string | null,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "attempts"?: number,"body": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"id"?: string,"last_error"?: string | null,"metadata"?: NonNullable<Json>,"notification_id"?: string | null,"recipient": string,"scheduled_at"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["delivery_status"],"subject"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"body"?: string,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"id"?: string,"last_error"?: string | null,"metadata"?: NonNullable<Json>,"notification_id"?: string | null,"recipient"?: string,"scheduled_at"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["delivery_status"],"subject"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"data": NonNullable<Json>,"id": string,"read_at": string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Insert: {
                    "body": string,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "body"?: string,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"otp_codes": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string,"id": string,"phone": string,"purpose": string,"used": boolean
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"expires_at": string,"id"?: string,"phone": string,"purpose"?: string,"used"?: boolean
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"phone"?: string,"purpose"?: string,"used"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"payment_intents": {
                  Row: {
                    "amount": number,"amount_minor": number | null,"checkout_request_id": string | null,"completed_at": string | null,"created_at": string,"currency": string,"error_message": string | null,"expires_at": string,"id": string,"idempotency_key": string | null,"merchant_request_id": string | null,"metadata": NonNullable<Json>,"phone": string | null,"provider": Database["public"]['Enums']["payment_provider"],"provider_reference": string | null,"reconcile_status": string,"settlement_status": string,"status": Database["public"]['Enums']["payment_intent_status"],"transaction_id": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount": number,"amount_minor"?: number | null,"checkout_request_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"currency"?: string,"error_message"?: string | null,"expires_at"?: string,"id"?: string,"idempotency_key"?: string | null,"merchant_request_id"?: string | null,"metadata"?: NonNullable<Json>,"phone"?: string | null,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_reference"?: string | null,"reconcile_status"?: string,"settlement_status"?: string,"status"?: Database["public"]['Enums']["payment_intent_status"],"transaction_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"amount_minor"?: number | null,"checkout_request_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"currency"?: string,"error_message"?: string | null,"expires_at"?: string,"id"?: string,"idempotency_key"?: string | null,"merchant_request_id"?: string | null,"metadata"?: NonNullable<Json>,"phone"?: string | null,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_reference"?: string | null,"reconcile_status"?: string,"settlement_status"?: string,"status"?: Database["public"]['Enums']["payment_intent_status"],"transaction_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_intents_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_intents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payouts": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"cycle_number": number,"id": string,"jamiya_id": string,"member_id": string,"notes": string | null,"paid_at": string | null,"receipt_confirmed_at": string | null,"receipt_confirmed_by": string | null,"scheduled_date": string,"status": Database["public"]['Enums']["payout_status"],"transaction_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"currency": string,"cycle_number": number,"id"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"paid_at"?: string | null,"receipt_confirmed_at"?: string | null,"receipt_confirmed_by"?: string | null,"scheduled_date": string,"status"?: Database["public"]['Enums']["payout_status"],"transaction_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"cycle_number"?: number,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"paid_at"?: string | null,"receipt_confirmed_at"?: string | null,"receipt_confirmed_by"?: string | null,"scheduled_date"?: string,"status"?: Database["public"]['Enums']["payout_status"],"transaction_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payouts_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_receipt_confirmed_by_fkey"
      columns: ["receipt_confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payouts_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"penalties": {
                  Row: {
                    "amount": number,"assessed_at": string,"contribution_id": string | null,"created_at": string,"currency": string,"fine_category_id": string | null,"id": string,"jamiya_id": string,"kind": string,"member_id": string,"notes": string | null,"paid_at": string | null,"qard_loan_id": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount": number,"assessed_at"?: string,"contribution_id"?: string | null,"created_at"?: string,"currency"?: string,"fine_category_id"?: string | null,"id"?: string,"jamiya_id": string,"kind": string,"member_id": string,"notes"?: string | null,"paid_at"?: string | null,"qard_loan_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"assessed_at"?: string,"contribution_id"?: string | null,"created_at"?: string,"currency"?: string,"fine_category_id"?: string | null,"id"?: string,"jamiya_id"?: string,"kind"?: string,"member_id"?: string,"notes"?: string | null,"paid_at"?: string | null,"qard_loan_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "penalties_contribution_id_fkey"
      columns: ["contribution_id"]
isOneToOne: false
      referencedRelation: "contributions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "penalties_fine_category_id_fkey"
      columns: ["fine_category_id"]
isOneToOne: false
      referencedRelation: "fine_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "penalties_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "penalties_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "penalties_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_plans": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string,"dual_approval_included": boolean,"exports_included": boolean,"id": string,"max_members": number,"name": string,"price_kes": number,"sms_credits_month": number,"sort_order": number,"whatsapp_enabled": boolean
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"dual_approval_included"?: boolean,"exports_included"?: boolean,"id": string,"max_members"?: number,"name": string,"price_kes"?: number,"sms_credits_month"?: number,"sort_order"?: number,"whatsapp_enabled"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"dual_approval_included"?: boolean,"exports_included"?: boolean,"id"?: string,"max_members"?: number,"name"?: string,"price_kes"?: number,"sms_credits_month"?: number,"sort_order"?: number,"whatsapp_enabled"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  Insert: {
                    "key": string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"platform_tips": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"id": string,"payment_intent_id": string | null,"phone": string | null,"user_id": string | null
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"currency"?: string,"id"?: string,"payment_intent_id"?: string | null,"phone"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"payment_intent_id"?: string | null,"phone"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_tips_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "platform_tips_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"country_code": string | null,"created_at": string,"date_of_birth": string | null,"email": string | null,"full_name": string | null,"id": string,"iprs_full_name": string | null,"iprs_status": string,"iprs_verified_at": string | null,"kyc_status": Database["public"]['Enums']["kyc_status"],"mpesa_phone": string | null,"national_id": string | null,"phone": string | null,"platform_role": Database["public"]['Enums']["platform_role"],"profile_completed": boolean,"referral_code": string | null,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"country_code"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"full_name"?: string | null,"id": string,"iprs_full_name"?: string | null,"iprs_status"?: string,"iprs_verified_at"?: string | null,"kyc_status"?: Database["public"]['Enums']["kyc_status"],"mpesa_phone"?: string | null,"national_id"?: string | null,"phone"?: string | null,"platform_role"?: Database["public"]['Enums']["platform_role"],"profile_completed"?: boolean,"referral_code"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"country_code"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string,"iprs_full_name"?: string | null,"iprs_status"?: string,"iprs_verified_at"?: string | null,"kyc_status"?: Database["public"]['Enums']["kyc_status"],"mpesa_phone"?: string | null,"national_id"?: string | null,"phone"?: string | null,"platform_role"?: Database["public"]['Enums']["platform_role"],"profile_completed"?: boolean,"referral_code"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"provider_transactions": {
                  Row: {
                    "amount": number,"amount_minor": number,"created_at": string,"currency": string,"direction": string,"id": string,"observed_at": string,"payment_intent_id": string | null,"provider": string,"provider_reference": string,"raw": NonNullable<Json>,"status": string
                  }
                  Insert: {
                    "amount": number,"amount_minor": number,"created_at"?: string,"currency"?: string,"direction": string,"id"?: string,"observed_at"?: string,"payment_intent_id"?: string | null,"provider": string,"provider_reference": string,"raw"?: NonNullable<Json>,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"amount_minor"?: number,"created_at"?: string,"currency"?: string,"direction"?: string,"id"?: string,"observed_at"?: string,"payment_intent_id"?: string | null,"provider"?: string,"provider_reference"?: string,"raw"?: NonNullable<Json>,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "provider_transactions_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    }
                  ]
                },"qard_guarantees": {
                  Row: {
                    "borrower_id": string,"created_at": string,"decided_at": string | null,"guarantor_user_id": string,"id": string,"jamiya_id": string,"loan_id": string,"notes": string | null,"status": Database["public"]['Enums']["qard_guarantee_status"],"updated_at": string
                  }
                  Insert: {
                    "borrower_id": string,"created_at"?: string,"decided_at"?: string | null,"guarantor_user_id": string,"id"?: string,"jamiya_id": string,"loan_id": string,"notes"?: string | null,"status"?: Database["public"]['Enums']["qard_guarantee_status"],"updated_at"?: string
                  }
                  Update: {
                    "borrower_id"?: string,"created_at"?: string,"decided_at"?: string | null,"guarantor_user_id"?: string,"id"?: string,"jamiya_id"?: string,"loan_id"?: string,"notes"?: string | null,"status"?: Database["public"]['Enums']["qard_guarantee_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "qard_guarantees_borrower_id_fkey"
      columns: ["borrower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qard_guarantees_guarantor_user_id_fkey"
      columns: ["guarantor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qard_guarantees_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qard_guarantees_loan_id_fkey"
      columns: ["loan_id"]
isOneToOne: false
      referencedRelation: "qard_loans"
      referencedColumns: ["id"]
    }
                  ]
                },"qard_loans": {
                  Row: {
                    "agreement_accepted_at": string | null,"agreement_signer_name": string | null,"agreement_version": string | null,"amount": number,"amount_repaid": number,"approved_by": string | null,"borrower_id": string,"created_at": string,"currency": string,"decided_at": string | null,"due_date": string | null,"id": string,"installment_count": number,"jamiya_id": string,"purpose": string,"status": Database["public"]['Enums']["qard_status"]
                  }
                  Insert: {
                    "agreement_accepted_at"?: string | null,"agreement_signer_name"?: string | null,"agreement_version"?: string | null,"amount": number,"amount_repaid"?: number,"approved_by"?: string | null,"borrower_id": string,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"due_date"?: string | null,"id"?: string,"installment_count"?: number,"jamiya_id": string,"purpose": string,"status"?: Database["public"]['Enums']["qard_status"]
                  }
                  Update: {
                    "agreement_accepted_at"?: string | null,"agreement_signer_name"?: string | null,"agreement_version"?: string | null,"amount"?: number,"amount_repaid"?: number,"approved_by"?: string | null,"borrower_id"?: string,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"due_date"?: string | null,"id"?: string,"installment_count"?: number,"jamiya_id"?: string,"purpose"?: string,"status"?: Database["public"]['Enums']["qard_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "qard_loans_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qard_loans_borrower_id_fkey"
      columns: ["borrower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qard_loans_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"qard_repayments": {
                  Row: {
                    "amount": number,"created_by": string,"currency": string,"id": string,"loan_id": string,"paid_at": string
                  }
                  Insert: {
                    "amount": number,"created_by": string,"currency"?: string,"id"?: string,"loan_id": string,"paid_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_by"?: string,"currency"?: string,"id"?: string,"loan_id"?: string,"paid_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "qard_repayments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qard_repayments_loan_id_fkey"
      columns: ["loan_id"]
isOneToOne: false
      referencedRelation: "qard_loans"
      referencedColumns: ["id"]
    }
                  ]
                },"reconcile_run_items": {
                  Row: {
                    "action": string,"created_at": string,"detail": NonNullable<Json>,"entity_id": string,"entity_type": string,"id": string,"provider": string | null,"result": string,"run_id": string
                  }
                  Insert: {
                    "action": string,"created_at"?: string,"detail"?: NonNullable<Json>,"entity_id": string,"entity_type": string,"id"?: string,"provider"?: string | null,"result": string,"run_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"detail"?: NonNullable<Json>,"entity_id"?: string,"entity_type"?: string,"id"?: string,"provider"?: string | null,"result"?: string,"run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reconcile_run_items_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "reconcile_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"reconcile_runs": {
                  Row: {
                    "created_at": string,"error_message": string | null,"finished_at": string | null,"id": string,"started_at": string,"status": string,"summary": NonNullable<Json>
                  }
                  Insert: {
                    "created_at"?: string,"error_message"?: string | null,"finished_at"?: string | null,"id"?: string,"started_at"?: string,"status"?: string,"summary"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"error_message"?: string | null,"finished_at"?: string | null,"id"?: string,"started_at"?: string,"status"?: string,"summary"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"referrals": {
                  Row: {
                    "created_at": string,"currency": string,"id": string,"referee_id": string,"referrer_id": string,"reward_amount": number,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"id"?: string,"referee_id": string,"referrer_id": string,"reward_amount"?: number,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"id"?: string,"referee_id"?: string,"referrer_id"?: string,"reward_amount"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "referrals_referee_id_fkey"
      columns: ["referee_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "referrals_referrer_id_fkey"
      columns: ["referrer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"amount_minor": number,"completed_at": string | null,"created_at": string,"created_by": string | null,"currency": string,"id": string,"journal_entry_id": string | null,"metadata": NonNullable<Json>,"payment_intent_id": string | null,"provider_reference": string | null,"reason": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"amount_minor": number,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"journal_entry_id"?: string | null,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"provider_reference"?: string | null,"reason"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"amount_minor"?: number,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"journal_entry_id"?: string | null,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"provider_reference"?: string | null,"reason"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_journal_entry_id_fkey"
      columns: ["journal_entry_id"]
isOneToOne: false
      referencedRelation: "journal_entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_dedupe": {
                  Row: {
                    "created_at": string,"dedupe_key": string
                  }
                  Insert: {
                    "created_at"?: string,"dedupe_key": string
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sadaka_institutions": {
                  Row: {
                    "contact_person": string,"contact_phone": string | null,"contact_user_id": string | null,"created_at": string,"id": string,"name": string,"registration_doc_url": string | null,"rejection_reason": string | null,"type": Database["public"]['Enums']["institution_type"],"updated_at": string,"verification_status": Database["public"]['Enums']["institution_verification_status"],"verified_at": string | null,"verified_by": string | null
                  }
                  Insert: {
                    "contact_person": string,"contact_phone"?: string | null,"contact_user_id"?: string | null,"created_at"?: string,"id"?: string,"name": string,"registration_doc_url"?: string | null,"rejection_reason"?: string | null,"type": Database["public"]['Enums']["institution_type"],"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["institution_verification_status"],"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "contact_person"?: string,"contact_phone"?: string | null,"contact_user_id"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"registration_doc_url"?: string | null,"rejection_reason"?: string | null,"type"?: Database["public"]['Enums']["institution_type"],"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["institution_verification_status"],"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sadaka_institutions_contact_user_id_fkey"
      columns: ["contact_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sadaka_institutions_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"savings_goal_contributions": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"effective_date": string,"goal_id": string,"id": string,"jamiya_id": string,"member_id": string,"notes": string | null,"recorded_by": string | null
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"currency"?: string,"effective_date"?: string,"goal_id": string,"id"?: string,"jamiya_id": string,"member_id": string,"notes"?: string | null,"recorded_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"effective_date"?: string,"goal_id"?: string,"id"?: string,"jamiya_id"?: string,"member_id"?: string,"notes"?: string | null,"recorded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "savings_goal_contributions_goal_id_fkey"
      columns: ["goal_id"]
isOneToOne: false
      referencedRelation: "savings_goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "savings_goal_contributions_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "savings_goal_contributions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"savings_goals": {
                  Row: {
                    "created_at": string,"currency": string,"duration_months": number | null,"id": string,"jamiya_id": string | null,"saved_amount": number,"target_amount": number,"target_date": string | null,"title": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"duration_months"?: number | null,"id"?: string,"jamiya_id"?: string | null,"saved_amount"?: number,"target_amount": number,"target_date"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"duration_months"?: number | null,"id"?: string,"jamiya_id"?: string | null,"saved_amount"?: number,"target_amount"?: number,"target_date"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "savings_goals_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "savings_goals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"savings_pockets": {
                  Row: {
                    "balance": number,"category": string,"created_at": string,"currency": string,"duration_months": number | null,"id": string,"jamiya_id": string,"label": string | null,"member_id": string,"target_amount": number | null,"updated_at": string
                  }
                  Insert: {
                    "balance"?: number,"category": string,"created_at"?: string,"currency"?: string,"duration_months"?: number | null,"id"?: string,"jamiya_id": string,"label"?: string | null,"member_id": string,"target_amount"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "balance"?: number,"category"?: string,"created_at"?: string,"currency"?: string,"duration_months"?: number | null,"id"?: string,"jamiya_id"?: string,"label"?: string | null,"member_id"?: string,"target_amount"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "savings_pockets_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "savings_pockets_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"settlements": {
                  Row: {
                    "amount": number,"amount_minor": number,"created_at": string,"currency": string,"id": string,"metadata": NonNullable<Json>,"payment_intent_id": string | null,"provider": string,"provider_reference": string | null,"settled_at": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"amount_minor": number,"created_at"?: string,"currency"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"provider": string,"provider_reference"?: string | null,"settled_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"amount_minor"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"provider"?: string,"provider_reference"?: string | null,"settled_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    }
                  ]
                },"sharia_fee_policy_events": {
                  Row: {
                    "actor_id": string | null,"campaign_id": string,"created_at": string,"decision_reference": string | null,"fee_bps": number,"fee_mode": Database["public"]['Enums']["fee_mode"],"id": string,"notes": string | null,"previous_endorsed": boolean | null,"previous_fee_bps": number | null,"previous_fee_mode": Database["public"]['Enums']["fee_mode"] | null,"sharia_board_endorsed": boolean
                  }
                  Insert: {
                    "actor_id"?: string | null,"campaign_id": string,"created_at"?: string,"decision_reference"?: string | null,"fee_bps": number,"fee_mode": Database["public"]['Enums']["fee_mode"],"id"?: string,"notes"?: string | null,"previous_endorsed"?: boolean | null,"previous_fee_bps"?: number | null,"previous_fee_mode"?: Database["public"]['Enums']["fee_mode"] | null,"sharia_board_endorsed": boolean
                  }
                  Update: {
                    "actor_id"?: string | null,"campaign_id"?: string,"created_at"?: string,"decision_reference"?: string | null,"fee_bps"?: number,"fee_mode"?: Database["public"]['Enums']["fee_mode"],"id"?: string,"notes"?: string | null,"previous_endorsed"?: boolean | null,"previous_fee_bps"?: number | null,"previous_fee_mode"?: Database["public"]['Enums']["fee_mode"] | null,"sharia_board_endorsed"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "sharia_fee_policy_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sharia_fee_policy_events_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "charity_campaigns"
      referencedColumns: ["id"]
    }
                  ]
                },"sponsorship_charges": {
                  Row: {
                    "amount": number,"charged_at": string,"currency": string,"fee_amount": number,"id": string,"metadata": NonNullable<Json>,"payment_intent_id": string | null,"sponsorship_id": string,"status": string
                  }
                  Insert: {
                    "amount": number,"charged_at"?: string,"currency"?: string,"fee_amount"?: number,"id"?: string,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"sponsorship_id": string,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"charged_at"?: string,"currency"?: string,"fee_amount"?: number,"id"?: string,"metadata"?: NonNullable<Json>,"payment_intent_id"?: string | null,"sponsorship_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sponsorship_charges_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sponsorship_charges_sponsorship_id_fkey"
      columns: ["sponsorship_id"]
isOneToOne: false
      referencedRelation: "sponsorships"
      referencedColumns: ["id"]
    }
                  ]
                },"sponsorships": {
                  Row: {
                    "adoption_profile_id": string,"created_at": string,"currency": string,"id": string,"metadata": NonNullable<Json>,"monthly_amount": number,"next_charge_date": string,"phone": string | null,"sponsor_user_id": string,"status": Database["public"]['Enums']["sponsorship_status"],"updated_at": string
                  }
                  Insert: {
                    "adoption_profile_id": string,"created_at"?: string,"currency"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"monthly_amount": number,"next_charge_date"?: string,"phone"?: string | null,"sponsor_user_id": string,"status"?: Database["public"]['Enums']["sponsorship_status"],"updated_at"?: string
                  }
                  Update: {
                    "adoption_profile_id"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"monthly_amount"?: number,"next_charge_date"?: string,"phone"?: string | null,"sponsor_user_id"?: string,"status"?: Database["public"]['Enums']["sponsorship_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sponsorships_adoption_profile_id_fkey"
      columns: ["adoption_profile_id"]
isOneToOne: false
      referencedRelation: "adoption_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sponsorships_sponsor_user_id_fkey"
      columns: ["sponsor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "admin_reply": string | null,"body": string,"created_at": string,"id": string,"replied_at": string | null,"replied_by": string | null,"status": string,"subject": string,"user_id": string
                  }
                  Insert: {
                    "admin_reply"?: string | null,"body": string,"created_at"?: string,"id"?: string,"replied_at"?: string | null,"replied_by"?: string | null,"status"?: string,"subject": string,"user_id": string
                  }
                  Update: {
                    "admin_reply"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"replied_at"?: string | null,"replied_by"?: string | null,"status"?: string,"subject"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_replied_by_fkey"
      columns: ["replied_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_tickets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tawarruq_applications": {
                  Row: {
                    "amount": number,"circle_profit_amount": number | null,"commodity": string | null,"created_at": string,"currency": string,"deferred_amount": number | null,"id": string,"installment_amount": number | null,"jamiya_id": string | null,"metadata": NonNullable<Json>,"partner_reference": string | null,"partner_status": string | null,"platform_fee_amount": number | null,"profit_amount": number | null,"profit_rate_bps": number | null,"purpose": string,"status": Database["public"]['Enums']["tawarruq_status"],"tenor_months": number | null,"updated_at": string,"user_id": string,"wakalah_accepted_at": string | null
                  }
                  Insert: {
                    "amount": number,"circle_profit_amount"?: number | null,"commodity"?: string | null,"created_at"?: string,"currency"?: string,"deferred_amount"?: number | null,"id"?: string,"installment_amount"?: number | null,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"partner_reference"?: string | null,"partner_status"?: string | null,"platform_fee_amount"?: number | null,"profit_amount"?: number | null,"profit_rate_bps"?: number | null,"purpose": string,"status"?: Database["public"]['Enums']["tawarruq_status"],"tenor_months"?: number | null,"updated_at"?: string,"user_id": string,"wakalah_accepted_at"?: string | null
                  }
                  Update: {
                    "amount"?: number,"circle_profit_amount"?: number | null,"commodity"?: string | null,"created_at"?: string,"currency"?: string,"deferred_amount"?: number | null,"id"?: string,"installment_amount"?: number | null,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"partner_reference"?: string | null,"partner_status"?: string | null,"platform_fee_amount"?: number | null,"profit_amount"?: number | null,"profit_rate_bps"?: number | null,"purpose"?: string,"status"?: Database["public"]['Enums']["tawarruq_status"],"tenor_months"?: number | null,"updated_at"?: string,"user_id"?: string,"wakalah_accepted_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tawarruq_applications_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tawarruq_applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tawarruq_guarantees": {
                  Row: {
                    "application_id": string,"borrower_id": string,"created_at": string,"decided_at": string | null,"guarantor_user_id": string,"id": string,"status": string
                  }
                  Insert: {
                    "application_id": string,"borrower_id": string,"created_at"?: string,"decided_at"?: string | null,"guarantor_user_id": string,"id"?: string,"status"?: string
                  }
                  Update: {
                    "application_id"?: string,"borrower_id"?: string,"created_at"?: string,"decided_at"?: string | null,"guarantor_user_id"?: string,"id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tawarruq_guarantees_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "tawarruq_applications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tawarruq_guarantees_borrower_id_fkey"
      columns: ["borrower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tawarruq_guarantees_guarantor_user_id_fkey"
      columns: ["guarantor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"direction": string,"id": string,"idempotency_key": string | null,"jamiya_id": string | null,"metadata": NonNullable<Json>,"processed_at": string | null,"reference": string | null,"status": Database["public"]['Enums']["transaction_status"],"type": Database["public"]['Enums']["transaction_type"],"updated_at": string,"user_id": string,"wallet_id": string
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"currency": string,"direction": string,"id"?: string,"idempotency_key"?: string | null,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"processed_at"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["transaction_status"],"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id": string,"wallet_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"direction"?: string,"id"?: string,"idempotency_key"?: string | null,"jamiya_id"?: string | null,"metadata"?: NonNullable<Json>,"processed_at"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["transaction_status"],"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id"?: string,"wallet_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_wallet_id_fkey"
      columns: ["wallet_id"]
isOneToOne: false
      referencedRelation: "wallets"
      referencedColumns: ["id"]
    }
                  ]
                },"treasury_payout_requests": {
                  Row: {
                    "amount": number,"book_entry_id": string | null,"category_id": string | null,"created_at": string,"currency": string,"destination_id": string,"error_message": string | null,"id": string,"jamiya_id": string,"metadata": NonNullable<Json>,"narrative": string | null,"provider": string | null,"provider_reference": string | null,"requested_by": string | null,"source_account_id": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"book_entry_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"destination_id": string,"error_message"?: string | null,"id"?: string,"jamiya_id": string,"metadata"?: NonNullable<Json>,"narrative"?: string | null,"provider"?: string | null,"provider_reference"?: string | null,"requested_by"?: string | null,"source_account_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"book_entry_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"currency"?: string,"destination_id"?: string,"error_message"?: string | null,"id"?: string,"jamiya_id"?: string,"metadata"?: NonNullable<Json>,"narrative"?: string | null,"provider"?: string | null,"provider_reference"?: string | null,"requested_by"?: string | null,"source_account_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treasury_payout_requests_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "circle_ledger_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treasury_payout_requests_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "circle_payout_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treasury_payout_requests_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treasury_payout_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treasury_payout_requests_source_account_id_fkey"
      columns: ["source_account_id"]
isOneToOne: false
      referencedRelation: "circle_bank_accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"user_payout_destinations": {
                  Row: {
                    "bank_account_name": string | null,"bank_account_number": string | null,"bank_name": string | null,"created_at": string,"id": string,"is_default": boolean,"kind": string,"label": string | null,"phone": string | null,"updated_at": string,"user_id": string,"verified_at": string | null
                  }
                  Insert: {
                    "bank_account_name"?: string | null,"bank_account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"kind": string,"label"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "bank_account_name"?: string | null,"bank_account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"id"?: string,"is_default"?: boolean,"kind"?: string,"label"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_payout_destinations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ussd_sessions": {
                  Row: {
                    "created_at": string,"id": string,"last_input": string | null,"menu_state": string,"metadata": NonNullable<Json>,"phone": string,"session_id": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_input"?: string | null,"menu_state"?: string,"metadata"?: NonNullable<Json>,"phone": string,"session_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_input"?: string | null,"menu_state"?: string,"metadata"?: NonNullable<Json>,"phone"?: string,"session_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ussd_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wallets": {
                  Row: {
                    "available_balance": number,"balance": number,"created_at": string,"currency": string,"id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "available_balance"?: number,"balance"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "available_balance"?: number,"balance"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wallets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "created_at": string,"error_message": string | null,"event_type": string | null,"external_id": string | null,"fingerprint": string,"headers": NonNullable<Json>,"id": string,"payload": NonNullable<Json>,"payment_intent_id": string | null,"processed_at": string | null,"provider": string,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"error_message"?: string | null,"event_type"?: string | null,"external_id"?: string | null,"fingerprint": string,"headers"?: NonNullable<Json>,"id"?: string,"payload"?: NonNullable<Json>,"payment_intent_id"?: string | null,"processed_at"?: string | null,"provider": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"error_message"?: string | null,"event_type"?: string | null,"external_id"?: string | null,"fingerprint"?: string,"headers"?: NonNullable<Json>,"id"?: string,"payload"?: NonNullable<Json>,"payment_intent_id"?: string | null,"processed_at"?: string | null,"provider"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_events_payment_intent_id_fkey"
      columns: ["payment_intent_id"]
isOneToOne: false
      referencedRelation: "payment_intents"
      referencedColumns: ["id"]
    }
                  ]
                },"welfare_claims": {
                  Row: {
                    "amount": number,"claim_type": string,"claimant_id": string,"created_at": string,"currency": string,"decided_at": string | null,"decided_by": string | null,"fund_id": string,"id": string,"jamiya_id": string,"reason": string,"status": Database["public"]['Enums']["welfare_claim_status"]
                  }
                  Insert: {
                    "amount": number,"claim_type": string,"claimant_id": string,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"fund_id": string,"id"?: string,"jamiya_id": string,"reason": string,"status"?: Database["public"]['Enums']["welfare_claim_status"]
                  }
                  Update: {
                    "amount"?: number,"claim_type"?: string,"claimant_id"?: string,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"fund_id"?: string,"id"?: string,"jamiya_id"?: string,"reason"?: string,"status"?: Database["public"]['Enums']["welfare_claim_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "welfare_claims_claimant_id_fkey"
      columns: ["claimant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "welfare_claims_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "welfare_claims_fund_id_fkey"
      columns: ["fund_id"]
isOneToOne: false
      referencedRelation: "welfare_funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "welfare_claims_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: false
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"welfare_funds": {
                  Row: {
                    "balance": number,"contribution_amount": number,"created_at": string,"currency": string,"id": string,"jamiya_id": string,"updated_at": string
                  }
                  Insert: {
                    "balance"?: number,"contribution_amount"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"jamiya_id": string,"updated_at"?: string
                  }
                  Update: {
                    "balance"?: number,"contribution_amount"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"jamiya_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "welfare_funds_jamiya_id_fkey"
      columns: ["jamiya_id"]
isOneToOne: true
      referencedRelation: "jamiyas"
      referencedColumns: ["id"]
    }
                  ]
                },"withdrawal_requests": {
                  Row: {
                    "amount": number,"bank_account_name": string | null,"bank_account_number": string | null,"bank_name": string | null,"created_at": string,"currency": string,"destination_id": string | null,"destination_phone": string | null,"destination_type": string,"error_message": string | null,"id": string,"metadata": NonNullable<Json>,"processed_at": string | null,"provider_reference": string | null,"status": Database["public"]['Enums']["withdrawal_status"],"transaction_id": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "amount": number,"bank_account_name"?: string | null,"bank_account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"currency"?: string,"destination_id"?: string | null,"destination_phone"?: string | null,"destination_type"?: string,"error_message"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"processed_at"?: string | null,"provider_reference"?: string | null,"status"?: Database["public"]['Enums']["withdrawal_status"],"transaction_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"bank_account_name"?: string | null,"bank_account_number"?: string | null,"bank_name"?: string | null,"created_at"?: string,"currency"?: string,"destination_id"?: string | null,"destination_phone"?: string | null,"destination_type"?: string,"error_message"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"processed_at"?: string | null,"provider_reference"?: string | null,"status"?: Database["public"]['Enums']["withdrawal_status"],"transaction_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "withdrawal_requests_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "user_payout_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "withdrawal_requests_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "withdrawal_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_invite_code"?: string,"p_payout_position"?: number,"p_token_hash"?: string }; Returns: Json
                           },
"accept_qard_agreement":
{ Args: { "p_loan_id": string,"p_signer_name": string }; Returns: Json
                           },
"activate_jamiya":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"admin_add_circle_member":
{ Args: { "p_email"?: string,"p_jamiya_id": string,"p_phone"?: string,"p_status"?: Database["public"]['Enums']["membership_status"],"p_user_id"?: string }; Returns: Json
                           },
"admin_delete_jamiya":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"admin_product_insights":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_set_jamiya_status":
{ Args: { "p_jamiya_id": string,"p_status": string }; Returns: Json
                           },
"allocate_circle_dividend":
{ Args: { "p_jamiya_id": string,"p_label": string,"p_notes"?: string,"p_period_end"?: string,"p_period_start"?: string,"p_total_amount": number }; Returns: Json
                           },
"apply_referral":
{ Args: { "p_code": string }; Returns: Json
                           },
"assess_contribution_penalties":
{ Args: { "p_jamiya_id"?: string }; Returns: Json
                           },
"assess_loan_penalties":
{ Args: { "p_jamiya_id"?: string }; Returns: Json
                           },
"backfill_missing_payment_journals":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"backfill_missing_settlements":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"backfill_missing_withdrawal_journals":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"backfill_payment_intent_journal":
{ Args: { "p_intent_id": string }; Returns: Json
                           },
"backfill_withdrawal_journal":
{ Args: { "p_withdrawal_id": string }; Returns: Json
                           },
"broadcast_announcement":
{ Args: { "p_body": string,"p_jamiya_id": string,"p_title": string }; Returns: Json
                           },
"cancel_refund":
{ Args: { "p_reason"?: string,"p_refund_id": string }; Returns: Json
                           },
"cast_circle_vote":
{ Args: { "p_candidate_id": string,"p_election_id": string }; Returns: Json
                           },
"charge_contribution_fee":
{ Args: { "p_contribution_id": string }; Returns: Json
                           },
"charge_early_slot_fee":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"charge_join_fee":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"circle_arrears_aging":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"circle_books_glance":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"circle_gl_pack":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"circle_journal":
{ Args: { "p_jamiya_id": string,"p_limit"?: number }; Returns: Json
                           },
"circle_officer_kpis":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"claim_notification_outbox":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"body": string,
"channel": Database["public"]['Enums']["notification_channel"],
"created_at": string,
"id": string,
"last_error": string | null,
"metadata": NonNullable<Json>,
"notification_id": string | null,
"recipient": string,
"scheduled_at": string,
"sent_at": string | null,
"status": Database["public"]['Enums']["delivery_status"],
"subject": string | null,
"updated_at": string,
"user_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "notification_outbox"
        isOneToOne: false
        isSetofReturn: true
      } } |
{ Args: { "p_channel"?: Database["public"]['Enums']["notification_channel"],"p_limit"?: number }; Returns: {
              "attempts": number,
"body": string,
"channel": Database["public"]['Enums']["notification_channel"],
"created_at": string,
"id": string,
"last_error": string | null,
"metadata": NonNullable<Json>,
"notification_id": string | null,
"recipient": string,
"scheduled_at": string,
"sent_at": string | null,
"status": Database["public"]['Enums']["delivery_status"],
"subject": string | null,
"updated_at": string,
"user_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "notification_outbox"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_payout_slot":
{ Args: { "p_jamiya_id": string,"p_payout_position": number }; Returns: Json
                           },
"claim_pending_sadaka_disbursements":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"claim_reminder_dedupe":
{ Args: { "p_key": string }; Returns: boolean
                           },
"close_circle_election":
{ Args: { "p_election_id": string }; Returns: Json
                           },
"complete_payment_intent":
{ Args: { "p_checkout_request_id"?: string,"p_intent_id": string,"p_metadata"?: Json,"p_provider_reference"?: string }; Returns: Json
                           },
"complete_refund":
{ Args: { "p_provider_reference"?: string,"p_refund_id": string }; Returns: Json
                           },
"complete_sadaka_disbursement":
{ Args: { "p_disbursement_id": string,"p_error"?: string,"p_mpesa_b2c_id"?: string,"p_success": boolean }; Returns: Json
                           },
"complete_treasury_payout":
{ Args: { "p_error_message"?: string,"p_fail"?: boolean,"p_payout_id": string,"p_provider_reference"?: string }; Returns: Json
                           },
"confirm_dual_approval":
{ Args: { "p_approve"?: boolean,"p_request_id": string }; Returns: Json
                           },
"confirm_payout_receipt":
{ Args: { "p_payout_id": string }; Returns: Json
                           },
"contribute_to_welfare":
{ Args: { "p_amount": number,"p_jamiya_id": string }; Returns: Json
                           },
"create_adoption_profile":
{ Args: { "p_description": string,"p_institution_id": string,"p_suggested_monthly_amount": number,"p_title": string }; Returns: Json
                           },
"create_circle_invitation":
{ Args: { "p_email"?: string,"p_expires_at"?: string,"p_invite_code"?: string,"p_invitee_user_id"?: string,"p_jamiya_id": string,"p_phone"?: string,"p_token_hash"?: string }; Returns: Json
                           },
"create_payment_intent":
{ Args: { "p_amount": number,"p_currency"?: string,"p_idempotency_key"?: string,"p_metadata"?: Json,"p_phone"?: string,"p_provider"?: Database["public"]['Enums']["payment_provider"] }; Returns: Json
                           },
"decide_grace_request":
{ Args: { "p_approve": boolean,"p_request_id": string }; Returns: Json
                           },
"decide_qard":
{ Args: { "p_approve": boolean,"p_loan_id": string }; Returns: Json
                           },
"decide_welfare_claim":
{ Args: { "p_approve": boolean,"p_claim_id": string,"p_notes"?: string }; Returns: Json
                           },
"decline_invitation":
{ Args: { "p_invite_code"?: string,"p_token_hash"?: string }; Returns: Json
                           },
"delete_member_next_of_kin":
{ Args: { "p_jamiya_id": string,"p_member_id": string }; Returns: Json
                           },
"disburse_sadaka_campaign":
{ Args: { "p_amount"?: number,"p_campaign_id": string,"p_notes"?: string }; Returns: Json
                           },
"enqueue_contribution_reminder":
{ Args: { "p_body": string,"p_data"?: Json,"p_dedupe_key": string,"p_title": string,"p_user_id": string }; Returns: Json
                           },
"enqueue_payout_reminder":
{ Args: { "p_body": string,"p_data"?: Json,"p_dedupe_key": string,"p_title": string,"p_user_id": string }; Returns: Json
                           },
"enqueue_user_reminder":
{ Args: { "p_body": string,"p_data"?: Json,"p_dedupe_key": string,"p_title": string,"p_type": string,"p_user_id": string }; Returns: Json
                           },
"ensure_circle_share_link":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"ensure_circle_treasury":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"ensure_member_loan_facility":
{ Args: { "p_jamiya_id": string,"p_member_id": string,"p_opened_on"?: string }; Returns: string
                           },
"ensure_welfare_fund":
{ Args: { "p_contribution_amount"?: number,"p_jamiya_id": string }; Returns: Json
                           },
"fail_payment_intent":
{ Args: { "p_error_message"?: string,"p_intent_id": string }; Returns: Json
                           },
"file_welfare_claim":
{ Args: { "p_amount": number,"p_claim_type": string,"p_jamiya_id": string,"p_reason"?: string }; Returns: Json
                           },
"finalize_webhook_event":
{ Args: { "p_error"?: string,"p_event_id": string,"p_payment_intent_id"?: string,"p_status": string }; Returns: undefined
                           },
"finance_integrity_snapshot":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_circle_plan":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"get_donation_receipt":
{ Args: { "p_code": string }; Returns: Json
                           },
"goal_member_totals":
{ Args: { "p_goal_id": string }; Returns: Json
                           },
"import_book_entries":
{ Args: { "p_jamiya_id": string,"p_rows": Json }; Returns: Json
                           },
"ingest_bank_alert":
{ Args: { "p_alert_text": string,"p_amount"?: number,"p_bank_account_id"?: string,"p_currency"?: string,"p_direction"?: string,"p_external_ref"?: string,"p_jamiya_id": string,"p_occurred_at"?: string,"p_provider": string }; Returns: Json
                           },
"ingest_webhook_event":
{ Args: { "p_event_type"?: string,"p_external_id"?: string,"p_fingerprint": string,"p_headers"?: Json,"p_payload": Json,"p_payment_intent_id"?: string,"p_provider": string }; Returns: Json
                           },
"issue_contribution_invoices":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           } |
{ Args: { "p_due_within_days"?: number,"p_jamiya_id": string }; Returns: Json
                           },
"levy_member_fine":
{ Args: { "p_amount"?: number,"p_fine_category_id": string,"p_jamiya_id": string,"p_member_id": string,"p_notes"?: string }; Returns: Json
                           },
"link_mpesa_phone":
{ Args: { "p_phone": string }; Returns: Json
                           },
"mark_late_contributions":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mark_outbox_failed":
{ Args: { "p_error": string,"p_id": string }; Returns: undefined
                           },
"mark_outbox_sent":
{ Args: { "p_id": string }; Returns: undefined
                           },
"mark_payment_intent_exception":
{ Args: { "p_intent_id": string,"p_note"?: string }; Returns: Json
                           },
"mark_payment_intent_processing":
{ Args: { "p_checkout_request_id"?: string,"p_intent_id": string,"p_merchant_request_id"?: string,"p_provider_reference"?: string }; Returns: Json
                           },
"mark_payment_intent_reconciled":
{ Args: { "p_intent_id": string,"p_settled"?: boolean }; Returns: Json
                           },
"mark_qard_defaulted":
{ Args: { "p_loan_id": string }; Returns: Json
                           },
"mark_referral_rewarded":
{ Args: { "p_referral_id": string }; Returns: Json
                           },
"mark_settlement_status":
{ Args: { "p_note"?: string,"p_settlement_id": string,"p_status": string }; Returns: Json
                           },
"match_bank_alerts":
{ Args: { "p_jamiya_id": string,"p_limit"?: number }; Returns: Json
                           },
"match_collection_playbook":
{ Args: { "p_case_id": string }; Returns: string
                           },
"member_circle_statement":
{ Args: { "p_jamiya_id": string,"p_member_id": string }; Returns: Json
                           },
"member_credit_snapshot":
{ Args: { "p_member_id": string }; Returns: Json
                           },
"member_loan_ledger_summary":
{ Args: { "p_jamiya_id": string,"p_member_id": string }; Returns: Json
                           },
"move_savings_pocket":
{ Args: { "p_amount": number,"p_direction": string,"p_pocket_id": string }; Returns: Json
                           },
"my_facility_qualification":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"nominate_election_candidate":
{ Args: { "p_election_id": string,"p_member_id": string }; Returns: Json
                           },
"nudge_circle_dues":
{ Args: { "p_due_within_days"?: number,"p_jamiya_id": string }; Returns: Json
                           },
"officer_assign_payout_slot":
{ Args: { "p_jamiya_id": string,"p_member_id": string,"p_payout_position": number }; Returns: Json
                           },
"officer_circle_snapshot":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"officer_mark_mgr_pot_paid":
{ Args: { "p_payout_id": string }; Returns: Json
                           },
"officer_record_contribution_payment":
{ Args: { "p_amount"?: number,"p_contribution_id": string,"p_notes"?: string }; Returns: Json
                           },
"officer_save_mgr_monthly_payments":
{ Args: { "p_jamiya_id": string,"p_rows": Json }; Returns: Json
                           },
"officer_void_ledger_line":
{ Args: { "p_id": string,"p_kind": string,"p_reason"?: string }; Returns: Json
                           },
"open_circle_election":
{ Args: { "p_closes_at"?: string,"p_jamiya_id": string,"p_seat_role": string,"p_title": string }; Returns: Json
                           },
"open_member_circle_payment":
{ Args: { "p_amount": number,"p_jamiya_id": string,"p_purpose": string }; Returns: Json
                           },
"pay_circle_dividend":
{ Args: { "p_bank_account_id": string,"p_dividend_id": string }; Returns: Json
                           },
"pay_contribution":
{ Args: { "p_amount"?: number,"p_contribution_id": string }; Returns: Json
                           },
"pay_contribution_ahead":
{ Args: { "p_contribution_id": string }; Returns: Json
                           } |
{ Args: { "p_amount"?: number,"p_contribution_id": string }; Returns: Json
                           },
"platform_admin_reset_circle_data":
{ Args: { "p_jamiya_id": string,"p_keep_user_id"?: string }; Returns: Json
                           },
"post_adoption_impact_report":
{ Args: { "p_adoption_profile_id": string,"p_body": string,"p_period_label": string }; Returns: Json
                           },
"preview_invitation":
{ Args: { "p_invite_code"?: string,"p_token_hash"?: string }; Returns: {
              "email": string,"expires_at": string,"invitation_id": string,"invited_by_name": string,"jamiya_id": string,"jamiya_name": string,"jamiya_slug": string,"phone": string,"status": Database["public"]['Enums']["invitation_status"]
            }[]
                           },
"process_circle_subscription_renewals":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"process_payout_cashout":
{ Args: { "p_simulate"?: boolean,"p_withdrawal_id": string }; Returns: Json
                           },
"process_withdrawal":
{ Args: { "p_approve"?: boolean,"p_error_message"?: string,"p_provider_reference"?: string,"p_withdrawal_id": string }; Returns: Json
                           },
"propose_decide_qard":
{ Args: { "p_approve": boolean,"p_loan_id": string }; Returns: Json
                           },
"propose_dual_approval":
{ Args: { "p_amount": number,"p_currency"?: string,"p_entity_id": string,"p_jamiya_id"?: string,"p_kind": string,"p_payload"?: Json }; Returns: Json
                           },
"propose_process_withdrawal":
{ Args: { "p_approve"?: boolean,"p_error_message"?: string,"p_provider_reference"?: string,"p_withdrawal_id": string }; Returns: Json
                           },
"propose_settle_payout":
{ Args: { "p_payout_id": string }; Returns: Json
                           },
"qard_cap_for_jamiya":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"qualify_referral_for_user":
{ Args: { "p_user_id": string }; Returns: number
                           },
"queue_bank_transfer_for_withdrawal":
{ Args: { "p_withdrawal_id": string }; Returns: Json
                           },
"queue_due_sponsorship_charges":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"queue_invitation_delivery":
{ Args: { "p_invitation_id": string,"p_invite_url": string }; Returns: Json
                           },
"queue_push_for_user":
{ Args: { "p_body": string,"p_data"?: Json,"p_title": string,"p_user_id": string }; Returns: number
                           },
"recompute_all_member_risk":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"recompute_member_risk":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"record_charity_donation":
{ Args: { "p_amount": number,"p_campaign_id": string,"p_donor_email"?: string,"p_donor_name"?: string,"p_donor_phone"?: string,"p_is_anonymous"?: boolean }; Returns: Json
                           },
"record_disbursement_settlement":
{ Args: { "p_metadata"?: Json,"p_provider"?: string,"p_provider_reference"?: string,"p_withdrawal_id": string }; Returns: Json
                           },
"record_goal_contribution":
{ Args: { "p_amount": number,"p_effective_date"?: string,"p_goal_id": string,"p_member_id": string,"p_notes"?: string }; Returns: Json
                           },
"record_member_loan_event":
{ Args: { "p_amount": number,"p_effective_date": string,"p_event_type": string,"p_jamiya_id": string,"p_member_id": string,"p_new_principal"?: number,"p_notes"?: string,"p_profit_amount"?: number }; Returns: Json
                           },
"record_platform_tip":
{ Args: { "p_amount": number,"p_phone"?: string }; Returns: Json
                           },
"record_settlement_for_intent":
{ Args: { "p_intent_id": string,"p_metadata"?: Json,"p_provider"?: string,"p_provider_reference"?: string }; Returns: Json
                           },
"record_share_purchase":
{ Args: { "p_bank_account_id"?: string,"p_jamiya_id": string,"p_member_id": string,"p_notes"?: string,"p_purchased_on"?: string,"p_shares": number,"p_unit_price"?: number }; Returns: Json
                           },
"record_treasury_entry":
{ Args: { "p_amount": number,"p_bank_account_id"?: string,"p_category_id"?: string,"p_counterparty_account_id"?: string,"p_effective_date": string,"p_entry_type": string,"p_investment_id"?: string,"p_jamiya_id": string,"p_member_id"?: string,"p_notes"?: string }; Returns: Json
                           },
"register_push_token":
{ Args: { "p_platform"?: string,"p_token": string }; Returns: Json
                           },
"register_sadaka_institution":
{ Args: { "p_contact_person": string,"p_contact_phone"?: string,"p_name": string,"p_registration_doc_url": string,"p_type": string }; Returns: Json
                           },
"remind_contribution_invoices":
{ Args: { "p_jamiya_id": string,"p_user_id"?: string }; Returns: Json
                           },
"repay_qard":
{ Args: { "p_amount": number,"p_loan_id": string }; Returns: Json
                           },
"reprocess_webhook_event":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"request_qard":
{ Args: { "p_amount": number,"p_guarantor_user_ids"?: (string)[],"p_installments"?: number,"p_jamiya_id": string,"p_purpose": string }; Returns: Json
                           },
"request_refund":
{ Args: { "p_amount": number,"p_metadata"?: Json,"p_payment_intent_id": string,"p_reason"?: string }; Returns: Json
                           },
"request_treasury_payout":
{ Args: { "p_amount": number,"p_category_id"?: string,"p_currency"?: string,"p_destination_id": string,"p_jamiya_id": string,"p_narrative"?: string,"p_source_account_id"?: string }; Returns: Json
                           },
"request_withdrawal":
{ Args: { "p_amount": number,"p_bank_account_name"?: string,"p_bank_account_number"?: string,"p_bank_name"?: string,"p_currency"?: string,"p_destination_phone"?: string,"p_destination_type"?: string }; Returns: Json
                           },
"requeue_webhook_event":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"resend_pending_invitations":
{ Args: { "p_base_url": string,"p_jamiya_id": string }; Returns: Json
                           },
"resolve_dispute":
{ Args: { "p_dispute_id": string,"p_resolution_notes"?: string,"p_status": Database["public"]['Enums']["dispute_status"] }; Returns: Json
                           },
"resolve_member_penalty":
{ Args: { "p_action": string,"p_notes"?: string,"p_penalty_id": string }; Returns: Json
                           },
"resolve_payment_intent_exception":
{ Args: { "p_action"?: string,"p_intent_id": string,"p_note"?: string }; Returns: Json
                           },
"respond_qard_guarantee":
{ Args: { "p_accept": boolean,"p_guarantee_id": string,"p_notes"?: string }; Returns: Json
                           },
"respond_tawarruq_guarantee":
{ Args: { "p_accept": boolean,"p_guarantee_id": string }; Returns: Json
                           },
"retry_payment_intent":
{ Args: { "p_intent_id": string }; Returns: Json
                           },
"review_jamiya_kyc_document":
{ Args: { "p_document_id": string,"p_notes"?: string,"p_status": string }; Returns: Json
                           },
"review_kyc_document":
{ Args: { "p_decision": Database["public"]['Enums']["kyc_document_status"],"p_document_id": string,"p_reason"?: string }; Returns: Json
                           },
"review_sadaka_campaign":
{ Args: { "p_approve": boolean,"p_campaign_id": string,"p_rejection_reason"?: string,"p_sharia_endorsed"?: boolean }; Returns: Json
                           },
"reward_qualified_referrals":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"run_auto_fines":
{ Args: { "p_jamiya_id"?: string }; Returns: Json
                           },
"run_collection_playbook":
{ Args: { "p_case_id": string,"p_playbook_id"?: string }; Returns: Json
                           },
"service_settle_payout":
{ Args: { "p_payout_id": string }; Returns: Json
                           },
"set_bank_alert_status":
{ Args: { "p_alert_id": string,"p_book_entry_id"?: string,"p_status": string }; Returns: Json
                           },
"set_campaign_fee_policy":
{ Args: { "p_campaign_id": string,"p_decision_reference"?: string,"p_fee_bps": number,"p_fee_mode": string,"p_notes"?: string,"p_sharia_board_endorsed": boolean,"p_status"?: string }; Returns: Json
                           },
"set_circle_auto_fine":
{ Args: { "p_enabled": boolean,"p_grace_days"?: number,"p_jamiya_id": string }; Returns: Json
                           },
"set_circle_dual_approval":
{ Args: { "p_enabled": boolean,"p_jamiya_id": string,"p_threshold"?: number }; Returns: Json
                           },
"set_circle_plan":
{ Args: { "p_jamiya_id": string,"p_plan_id": string }; Returns: Json
                           },
"set_member_role":
{ Args: { "p_member_id": string,"p_role": string }; Returns: Json
                           },
"set_platform_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: Json
                           },
"settle_payout":
{ Args: { "p_payout_id": string }; Returns: Json
                           },
"settle_payout_to_mpesa":
{ Args: { "p_payout_id": string,"p_phone"?: string }; Returns: Json
                           } |
{ Args: { "p_auto_simulate"?: boolean,"p_payout_id": string,"p_phone"?: string }; Returns: Json
                           },
"start_sponsorship":
{ Args: { "p_adoption_profile_id": string,"p_monthly_amount": number,"p_phone"?: string }; Returns: Json
                           },
"submit_jameiyah_tawarruq":
{ Args: { "p_amount": number,"p_guarantor_user_id"?: string,"p_jamiya_id": string,"p_profit_rate_bps": number,"p_purpose": string,"p_tenor_months": number,"p_wakalah": boolean }; Returns: Json
                           },
"submit_sadaka_campaign":
{ Args: { "p_beneficiary_kyc_doc_url": string,"p_beneficiary_name": string,"p_beneficiary_phone": string,"p_category": string,"p_cover_image_url"?: string,"p_public_media_urls"?: (string)[],"p_slug"?: string,"p_story": string,"p_target_amount": number,"p_title": string }; Returns: Json
                           },
"submit_tawarruq_application":
{ Args: { "p_amount": number,"p_jamiya_id"?: string,"p_purpose": string }; Returns: Json
                           },
"submit_tawarruq_to_partner":
{ Args: { "p_application_id": string }; Returns: Json
                           },
"sync_collection_cases":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"sync_phone_from_auth":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"table_banking_fund":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"tawarruq_exposure":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"treasury_snapshot":
{ Args: { "p_jamiya_id": string }; Returns: Json
                           },
"update_circle_investment":
{ Args: { "p_current_value"?: number,"p_investment_id": string,"p_name"?: string,"p_notes"?: string,"p_status"?: string }; Returns: Json
                           },
"update_collection_case":
{ Args: { "p_case_id": string,"p_notes"?: string,"p_promised_pay_date"?: string,"p_status": Database["public"]['Enums']["collection_status"] }; Returns: Json
                           },
"update_tawarruq_partner_status":
{ Args: { "p_application_id": string,"p_notes"?: string,"p_partner_reference"?: string,"p_partner_status"?: string,"p_status": string }; Returns: Json
                           },
"upsert_member_month_savings":
{ Args: { "p_jamiya_id": string,"p_rows": Json }; Returns: Json
                           },
"upsert_member_next_of_kin":
{ Args: { "p_full_name": string,"p_jamiya_id": string,"p_member_id": string,"p_notes"?: string,"p_phone"?: string,"p_relationship"?: string }; Returns: Json
                           },
"upsert_member_share_capital":
{ Args: { "p_jamiya_id": string,"p_rows": Json }; Returns: Json
                           },
"verify_sadaka_institution":
{ Args: { "p_approve": boolean,"p_institution_id": string,"p_rejection_reason"?: string }; Returns: Json
                           },
"vouch_for_member":
{ Args: { "p_approve": boolean,"p_member_id": string,"p_notes"?: string }; Returns: Json
                           },
"wallet_top_up":
{ Args: { "p_amount": number,"p_currency"?: string,"p_idempotency_key"?: string }; Returns: Json
                           }
          }
          Enums: {
            "adoption_profile_status": "active"|"paused"|"closed","audit_action": "create"|"update"|"delete"|"login"|"logout"|"invite"|"join"|"leave"|"approve"|"reject"|"export"|"role_change","bank_transfer_status": "queued"|"submitted"|"settled"|"failed"|"cancelled","campaign_status": "draft"|"live"|"paused"|"completed"|"cancelled"|"pending_review"|"rejected"|"funded"|"disbursed"|"closed","circle_segment": "general"|"womens_circle"|"boda_stage","collection_severity": "watch"|"overdue"|"severe"|"critical","collection_status": "open"|"contacted"|"promised"|"partially_paid"|"resolved"|"written_off"|"cancelled","contribution_status": "pending"|"paid"|"late"|"waived"|"failed"|"partial","delivery_status": "pending"|"processing"|"sent"|"failed"|"skipped","disbursement_status": "pending"|"processing"|"paid"|"failed"|"cancelled","dispute_status": "open"|"under_review"|"resolved"|"rejected"|"cancelled","dispute_type": "missed_contribution"|"payout_delay"|"incorrect_amount"|"membership"|"other","election_status": "open"|"closed"|"cancelled","fee_mode": "join_fee"|"per_transaction"|"donation_addon"|"donation_deduct"|"platform_tip","grace_request_status": "pending"|"approved"|"rejected"|"cancelled","institution_type": "mosque"|"madrasa"|"orphanage","institution_verification_status": "pending_verification"|"verified"|"rejected","invitation_status": "pending"|"accepted"|"declined"|"expired"|"revoked","jamiya_status": "draft"|"open"|"active"|"paused"|"completed"|"cancelled"|"suspended","kyc_document_status": "uploaded"|"under_review"|"approved"|"rejected","kyc_document_type": "national_id"|"passport"|"driving_license"|"proof_of_address"|"selfie"|"other","kyc_status": "not_started"|"pending"|"under_review"|"approved"|"rejected","meeting_status": "scheduled"|"completed"|"cancelled","membership_role": "member"|"circle_admin"|"treasurer"|"secretary"|"chair","membership_status": "invited"|"active"|"suspended"|"left"|"removed"|"deceased","notification_channel": "in_app"|"email"|"sms"|"push"|"whatsapp","notification_type": "invitation"|"contribution_due"|"contribution_received"|"payout_scheduled"|"payout_paid"|"kyc_update"|"system"|"admin","payment_intent_status": "pending"|"processing"|"completed"|"failed"|"cancelled"|"expired","payment_provider": "simulated"|"mpesa"|"bank"|"paystack"|"intasend"|"tendepay"|"coop"|"kcb","payout_status": "scheduled"|"processing"|"paid"|"failed"|"cancelled","platform_role": "member"|"compliance_officer"|"platform_admin"|"super_admin","playbook_channel": "in_app"|"email"|"sms"|"call_task","qard_guarantee_status": "pending"|"accepted"|"declined"|"released"|"exposed","qard_status": "requested"|"approved"|"rejected"|"active"|"repaid"|"defaulted"|"cancelled","risk_band": "low"|"medium"|"high"|"critical","sadaka_category": "medical"|"funeral"|"education"|"business_startup"|"emergency_disaster"|"institutional","sponsorship_status": "active"|"paused"|"cancelled","tawarruq_status": "requested"|"submitted_to_partner"|"approved"|"rejected"|"disbursed"|"closed","transaction_status": "pending"|"processing"|"completed"|"failed"|"reversed","transaction_type": "contribution"|"payout"|"wallet_top_up"|"wallet_withdrawal"|"fee"|"adjustment"|"qard_repayment"|"refund","vouch_status": "pending"|"approved"|"rejected","welfare_claim_status": "pending"|"approved"|"rejected"|"paid"|"cancelled","withdrawal_status": "pending"|"processing"|"completed"|"failed"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "adoption_profile_status": ["active", "paused", "closed"],"audit_action": ["create", "update", "delete", "login", "logout", "invite", "join", "leave", "approve", "reject", "export", "role_change"],"bank_transfer_status": ["queued", "submitted", "settled", "failed", "cancelled"],"campaign_status": ["draft", "live", "paused", "completed", "cancelled", "pending_review", "rejected", "funded", "disbursed", "closed"],"circle_segment": ["general", "womens_circle", "boda_stage"],"collection_severity": ["watch", "overdue", "severe", "critical"],"collection_status": ["open", "contacted", "promised", "partially_paid", "resolved", "written_off", "cancelled"],"contribution_status": ["pending", "paid", "late", "waived", "failed", "partial"],"delivery_status": ["pending", "processing", "sent", "failed", "skipped"],"disbursement_status": ["pending", "processing", "paid", "failed", "cancelled"],"dispute_status": ["open", "under_review", "resolved", "rejected", "cancelled"],"dispute_type": ["missed_contribution", "payout_delay", "incorrect_amount", "membership", "other"],"election_status": ["open", "closed", "cancelled"],"fee_mode": ["join_fee", "per_transaction", "donation_addon", "donation_deduct", "platform_tip"],"grace_request_status": ["pending", "approved", "rejected", "cancelled"],"institution_type": ["mosque", "madrasa", "orphanage"],"institution_verification_status": ["pending_verification", "verified", "rejected"],"invitation_status": ["pending", "accepted", "declined", "expired", "revoked"],"jamiya_status": ["draft", "open", "active", "paused", "completed", "cancelled", "suspended"],"kyc_document_status": ["uploaded", "under_review", "approved", "rejected"],"kyc_document_type": ["national_id", "passport", "driving_license", "proof_of_address", "selfie", "other"],"kyc_status": ["not_started", "pending", "under_review", "approved", "rejected"],"meeting_status": ["scheduled", "completed", "cancelled"],"membership_role": ["member", "circle_admin", "treasurer", "secretary", "chair"],"membership_status": ["invited", "active", "suspended", "left", "removed", "deceased"],"notification_channel": ["in_app", "email", "sms", "push", "whatsapp"],"notification_type": ["invitation", "contribution_due", "contribution_received", "payout_scheduled", "payout_paid", "kyc_update", "system", "admin"],"payment_intent_status": ["pending", "processing", "completed", "failed", "cancelled", "expired"],"payment_provider": ["simulated", "mpesa", "bank", "paystack", "intasend", "tendepay", "coop", "kcb"],"payout_status": ["scheduled", "processing", "paid", "failed", "cancelled"],"platform_role": ["member", "compliance_officer", "platform_admin", "super_admin"],"playbook_channel": ["in_app", "email", "sms", "call_task"],"qard_guarantee_status": ["pending", "accepted", "declined", "released", "exposed"],"qard_status": ["requested", "approved", "rejected", "active", "repaid", "defaulted", "cancelled"],"risk_band": ["low", "medium", "high", "critical"],"sadaka_category": ["medical", "funeral", "education", "business_startup", "emergency_disaster", "institutional"],"sponsorship_status": ["active", "paused", "cancelled"],"tawarruq_status": ["requested", "submitted_to_partner", "approved", "rejected", "disbursed", "closed"],"transaction_status": ["pending", "processing", "completed", "failed", "reversed"],"transaction_type": ["contribution", "payout", "wallet_top_up", "wallet_withdrawal", "fee", "adjustment", "qard_repayment", "refund"],"vouch_status": ["pending", "approved", "rejected"],"welfare_claim_status": ["pending", "approved", "rejected", "paid", "cancelled"],"withdrawal_status": ["pending", "processing", "completed", "failed", "cancelled"]
          }
        }
} as const

