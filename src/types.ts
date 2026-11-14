export type ProviderId = 'gmail' | 'outlook';
export interface DBStmt {
  bind(...values: unknown[]): DBStmt;
  first<T=Record<string, unknown>>(): Promise<T|null>;
  all<T=Record<string, unknown>>(): Promise<{results:T[]}>;
  run(): Promise<{success:boolean; meta?: Record<string,unknown>}>;
}
export interface DB {
  prepare(sql:string): DBStmt;
  batch?(statements:DBStmt[]): Promise<unknown[]>;
}
export interface Env {
  DB: DB;
  APP_SECRET: string;
  INSTALLATION_PASSPHRASE: string;
  PUBLIC_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_TENANT?: string;
  SYNC_LIMIT?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_CONTACT?: string;
  PUSH_ENABLED?: string;
  /** Defaults to human review. Explicit opt-in and exact sender address allowlist
   * are needed to enable calendar writes without a manual confirmation. */
  /** Legacy trusted-senders is accepted only for migration; no automatic writes in 2.4. */
 AUTO_APPROVE_MODE?: 'review' | 'trusted-senders';
  TRUSTED_SENDER_ADDRESSES?: string;
}
export interface ExecutionContext {waitUntil(promise:Promise<unknown>):void;}
export interface RemoteMessage {
  id:string; revision:string; subject:string; body:string;
  receivedAt:string; sender?:string; threadId?:string; calendarText?:string[];
  /** Provider text was cropped or MIME traversal hit a safety cap. Never auto-act on partial evidence. */
  textIncomplete?:boolean;
}
export interface SyncPage {messages: Array<{id:string;revision:string; envelope?:import('./domain/monitoring.ts').MessageEnvelope}>; nextPage:string|null; nextCursor:string|null; anchor?:string|null;}
export interface Connection {
  id:string; provider:ProviderId; account_hint:string; token_ciphertext:string;
  calendar_id:string|null; sync_cursor:string|null; sync_page:string|null;
  sync_anchor:string|null; sync_mode:'bootstrap'|'delta';
  last_sync_at:number|null; last_attempt_at?:number|null;last_success_at?:number|null; last_error:string|null; enabled:number;locked_until:number;next_sync_at?:number;
  created_at:number;updated_at:number;
}
export interface InboxRow {
 id:number; connection_id:string;remote_id:string;remote_revision:string;
 state:'queued'|'done'|'retry';attempts:number;next_attempt_at:number;last_error:string|null;received_at:number;
 /** Bounded, explicitly requested full review of a previously filtered message. */
 force_full_read:number;
}
export interface AcademicItem {
 id:string;connection_id:string;inbox_id:number;kind:'event'|'task'|'notice'|'review';
 title:string;details:string;start_at:string|null;due_date:string|null;
 time_zone:string;confidence:'explicit'|'incomplete'|'ambiguous';
 source_excerpt:string;rationale:string;state:'review'|'approved'|'notice'|'ignored'|'synced';
 created_at:number;updated_at:number;
}
export interface OutboxRow {
 id:string;item_id:string;connection_id:string;action:'create';
 state:'planned'|'in_flight'|'unknown'|'retryable'|'committed'|'blocked';
 attempt_count:number;next_attempt_at:number;remote_event_id:string|null;last_error:string|null;
 locked_until:number;probe_count:number;created_at:number;updated_at:number;
}
export interface Tokens {access_token:string;refresh_token:string;expires_at:number;scope?:string;token_type?:string;}
export interface ProviderHTTP {fetch(input:RequestInfo|URL, init?:RequestInit):Promise<Response>}
export interface AcademicDecision {
 kind:'event'|'task'|'notice'|'review';title:string;details:string;start_at:string|null;
 due_date:string|null;confidence:'explicit'|'incomplete'|'ambiguous';
 state:'review'|'approved'|'notice'|'ignored';source_excerpt:string;rationale:string;
}

export interface CalendarChange {
 id:string;item_id:string;connection_id:string;action:'update'|'cancel';
 state:'planned'|'in_flight'|'unknown'|'retryable'|'committed'|'blocked';
 expected_remote_id:string;desired_start_at:string|null;desired_due_date:string|null;
 desired_title:string|null;attempt_count:number;next_attempt_at:number;
 locked_until:number;last_error:string|null;created_at:number;updated_at:number;
}
