// =============================================
// CLEANING APP - DATABASE TYPES
// =============================================
// This file is the SINGLE SOURCE OF TRUTH for all database types.
// ALL components and agents MUST import from here.
// DO NOT create duplicate type definitions elsewhere.
// =============================================

// =============================================
// ENUMS (must match database exactly)
// =============================================

export type JobTemplateStatus = 'DRAFT' | 'ACTIVE'

export type JobSessionStatus =
  | 'OFFERED'      // Posted to marketplace, waiting for employee
  | 'CLAIMED'      // Employee picked it, waiting approval
  | 'APPROVED'     // Employer approved, scheduled
  | 'IN_PROGRESS'  // Employee working on it
  | 'COMPLETED'    // Job finished
  | 'EVALUATED'    // Customer submitted rating
  | 'CANCELLED'    // Session cancelled

export type EmployeeStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export type ExchangeStatus = 'PENDING' | 'APPROVED' | 'DENIED'

export type StrikeSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'

export type StrikeTargetType = 'CUSTOMER' | 'EMPLOYEE'

export type ConversationType = 'DIRECT' | 'ANNOUNCEMENT' | 'EMPLOYEE_GROUP'

export type UserType = 'EMPLOYER' | 'EMPLOYEE' | 'CUSTOMER'

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export type ThemeType = 'LIGHT' | 'DARK'

// =============================================
// TABLE TYPES
// =============================================

// Base type for all tables with timestamps
interface BaseTable {
  id: string // UUID
  created_at: string // TIMESTAMPTZ
}

// --- USER TABLES ---

export interface Employer extends BaseTable {
  user_id: string // FK to auth.users
  full_name: string
  email: string
  phone: string | null
  address: string | null
  notes: string | null
  updated_at: string
}

export interface Employee extends BaseTable {
  user_id: string | null // FK to auth.users
  full_name: string
  email: string
  phone: string | null
  address: string | null
  void_cheque_url: string | null
  notes: string | null
  status: EmployeeStatus
  created_by: string | null // FK to employers
  activated_by: string | null // FK to employers
  activated_at: string | null
  updated_at: string
}

export interface Customer extends BaseTable {
  user_id: string | null // FK to auth.users
  customer_code: string // 3-letter code (ABC)
  full_name: string
  email: string
  phone: string | null
  address: string | null
  notes: string | null
  status: CustomerStatus
  created_by: string // FK to employers
  updated_at: string
}

export interface CompanyInfo extends BaseTable {
  employer_id: string // FK to employers
  company_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  default_hourly_rate: number | null
  tax_number: string | null
  updated_at: string
}

// --- JOB TABLES ---

export interface JobTemplate extends BaseTable {
  client_code: string // 3-letter code
  template_number: string // 01-99
  version_letter: string // A, B, C...
  job_code: string // Generated: ABC-01A
  title: string
  description: string | null
  address: string | null
  duration_minutes: number | null
  price_per_hour: number | null
  notes: string | null
  timezone: string
  available_days: DayOfWeek[]
  time_window_start: string | null // TIME
  time_window_end: string | null // TIME
  is_recurring: boolean
  frequency_per_week: number | null
  status: JobTemplateStatus
  customer_id: string | null // FK to customers
  created_by: string // FK to employers
  updated_at: string
}

export interface JobStep extends BaseTable {
  job_template_id: string // FK to job_templates
  step_order: number
  title: string
  description: string | null
  products_needed: string | null
}

export interface JobStepImage extends BaseTable {
  job_step_id: string // FK to job_steps
  image_url: string
  image_order: number
  caption: string | null
}

export interface JobStepChecklist {
  id: string
  job_step_id: string // FK to job_steps
  item_text: string
  item_order: number
}

export interface JobSession extends BaseTable {
  job_template_id: string // FK to job_templates
  session_code: string // A001, A002...
  full_job_code: string | null // ABC-01A-A001
  scheduled_date: string | null // DATE
  scheduled_time: string | null // TIME
  assigned_to: string | null // FK to employees
  status: JobSessionStatus
  price_override: number | null
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

export interface JobSessionProgress {
  id: string
  job_session_id: string // FK to job_sessions
  job_step_id: string // FK to job_steps
  is_completed: boolean
  completed_at: string | null
}

export interface JobSessionChecklistProgress {
  id: string
  job_session_id: string // FK to job_sessions
  checklist_item_id: string // FK to job_step_checklist
  is_checked: boolean
  checked_at: string | null
}

// --- MESSAGE TABLES ---

export interface Conversation extends BaseTable {
  type: ConversationType
  created_by: string // FK to auth.users
}

export interface ConversationParticipant {
  id: string
  conversation_id: string // FK to conversations
  user_id: string // FK to auth.users
  joined_at: string
}

export interface Message {
  id: string
  conversation_id: string // FK to conversations
  sender_id: string // FK to auth.users
  content: string
  job_session_id: string | null // FK to job_sessions
  is_system: boolean
  sent_at: string
  read_at: string | null
}

export interface ScheduleMessage extends BaseTable {
  job_session_id: string // FK to job_sessions
  employee_id: string // FK to employees
  message: string | null
  sent_at: string
  read_at: string | null
}

// --- INTERACTION TABLES ---

export interface Evaluation extends BaseTable {
  job_session_id: string // FK to job_sessions
  customer_id: string // FK to customers
  employee_id: string // FK to employees
  rating: 1 | 2 | 3 | 4 | 5
  comment: string | null
  submitted_at: string | null
}

export interface Strike extends BaseTable {
  target_type: StrikeTargetType
  target_id: string // FK to customer or employee
  date: string // DATE
  description: string
  notes: string | null
  severity: StrikeSeverity
  created_by: string // FK to employers
}

export interface JobExchange {
  id: string
  job_session_id: string // FK to job_sessions
  from_employee_id: string // FK to employees
  to_employee_id: string | null // FK to employees
  reason: string | null
  status: ExchangeStatus
  requested_at: string
  decided_at: string | null
  decided_by: string | null // FK to employers
}

export interface Notification extends BaseTable {
  user_id: string // FK to auth.users
  user_type: UserType
  type: string
  title: string
  message: string | null
  related_id: string | null
  is_read: boolean
}

// --- SETTINGS TABLES ---

export interface EmployerSettings extends BaseTable {
  employer_id: string // FK to employers
  theme: ThemeType
  primary_color: string
  logo_url: string | null
  language: string
  push_enabled: boolean
  notify_new_message: boolean
  notify_job_claimed: boolean
  notify_exchange_request: boolean
  reminder_2_days: boolean
  reminder_1_day: boolean
  reminder_6_hours: boolean
  sound_enabled: boolean
  updated_at: string
}

export interface NotificationSettings {
  id: string
  user_id: string // FK to auth.users
  notification_type: string
  is_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean
}

export interface ReminderSettings {
  id: string
  employer_id: string // FK to employers
  reminder_2_days: boolean
  reminder_1_day: boolean
  reminder_6_hours: boolean
}

// --- AVAILABILITY TABLES ---

export interface EmployeeAvailability {
  id: string
  employee_id: string // FK to employees
  day_of_week: DayOfWeek
  is_available: boolean
  start_time: string | null // TIME
  end_time: string | null // TIME
  timezone: string
}

export interface EmployeeAvailabilityDate {
  id: string
  employee_id: string // FK to employees
  date: string // DATE
  is_available: boolean
  note: string | null
}

// =============================================
// NOTIFICATION TYPES
// =============================================

export const NOTIFICATION_TYPES = {
  // Employer notifications
  JOB_CLAIMED: 'JOB_CLAIMED',
  EXCHANGE_REQUEST: 'EXCHANGE_REQUEST',
  JOB_COMPLETED: 'JOB_COMPLETED',
  NEW_REGISTRATION: 'NEW_REGISTRATION',
  NEW_MESSAGE: 'NEW_MESSAGE',
  EVALUATION_SUBMITTED: 'EVALUATION_SUBMITTED',

  // Employee notifications
  JOB_APPROVED: 'JOB_APPROVED',
  JOB_REFUSED: 'JOB_REFUSED',
  EXCHANGE_APPROVED: 'EXCHANGE_APPROVED',
  EXCHANGE_DENIED: 'EXCHANGE_DENIED',
  JOB_PUSHED: 'JOB_PUSHED',
  REMINDER_2_DAYS: 'REMINDER_2_DAYS',
  REMINDER_1_DAY: 'REMINDER_1_DAY',
  REMINDER_6_HOURS: 'REMINDER_6_HOURS',
  NEW_ANNOUNCEMENT: 'NEW_ANNOUNCEMENT',
  NEW_EVALUATION: 'NEW_EVALUATION',
} as const

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES]

// =============================================
// HELPER TYPES FOR FORMS
// =============================================

// For creating new records (without id and timestamps)
export type NewJobTemplate = Omit<JobTemplate, 'id' | 'created_at' | 'updated_at' | 'job_code'>
export type NewJobStep = Omit<JobStep, 'id' | 'created_at'>
export type NewJobSession = Omit<JobSession, 'id' | 'created_at' | 'updated_at'>
export type NewCustomer = Omit<Customer, 'id' | 'created_at' | 'updated_at'>
export type NewEmployee = Omit<Employee, 'id' | 'created_at' | 'updated_at'>
export type NewEvaluation = Omit<Evaluation, 'id' | 'created_at'>
export type NewStrike = Omit<Strike, 'id' | 'created_at'>

// =============================================
// JOIN TYPES (for queries with related data)
// =============================================

export interface JobTemplateWithCustomer extends JobTemplate {
  customer: Customer | null
}

export interface JobTemplateWithSteps extends JobTemplate {
  job_steps: JobStep[]
}

export interface JobSessionWithTemplate extends JobSession {
  job_template: JobTemplate
}

export interface JobSessionWithEmployee extends JobSession {
  employee: Employee | null
}

export interface JobSessionFull extends JobSession {
  job_template: JobTemplateWithCustomer
  employee: Employee | null
}

export interface EvaluationWithDetails extends Evaluation {
  job_session: JobSession
  customer: Customer
  employee: Employee
}

export interface StrikeWithTarget extends Strike {
  target: Customer | Employee
}
