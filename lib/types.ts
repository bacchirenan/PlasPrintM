// Tipos do banco de dados PlasPrint Manutenção
// Compatível com PlasPrint IA

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Frequency = 'weekly' | 'biweekly' | 'quarterly' | 'semiannual'
export type UserRole = 'user' | 'master' | 'admin'
export type Rating = 'ruim' | 'bom' | 'otimo'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Machine {
  id: string
  name: string
  number: string
  description: string | null
  active: boolean
  type: 'machine' | 'room'
  created_at: string
}

export interface MaintenanceCategory {
  id: string
  name: string
  frequency: Frequency
  frequency_days: number
  display_order: number
  created_at: string
}

export interface MaintenanceItem {
  id: string
  category_id: string
  name: string
  display_order: number
  active: boolean
  target_type: 'machine' | 'room' | 'both'
  created_at: string
  // joined
  category?: MaintenanceCategory
}

export interface MaintenanceLog {
  id: string
  machine_id: string
  item_id: string
  user_id: string | null
  completed_at: string
  rating: Rating | null
  observation: string | null
  created_at: string
  // joined
  machine?: Machine
  item?: MaintenanceItem
  user?: Profile
}

export interface EmailAlert {
  id: string
  machine_id: string
  item_id: string
  alert_type: string
  sent_at: string
  recipient_email: string
}

export interface MaintenanceStatus {
  id: string
  machine_number: string
  machine_name: string
  category_name: string
  frequency: Frequency
  frequency_days: number
  item_name: string
  completed_at: string
  rating: Rating | null
  observation: string | null
  user_name: string | null
  user_email: string | null
  time_since_completion: string
  is_overdue: boolean
}

// Estado do checklist: machine_id -> item_id -> último log
export type ChecklistState = Record<string, Record<string, MaintenanceLog | null>>

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
}

export const RATING_LABELS: Record<Rating, string> = {
  ruim: 'Ruim',
  bom: 'Bom',
  otimo: 'Ótimo',
}

export const MACHINE_NUMBERS = ['28', '29', '180', '181', '182', 'ENCAB_CANUDOS']

export interface InventoryItem {
  id: string
  name: string
  code: string | null
  quantity: number
  min_quantity: number | null
  location: string | null
  category: 'peca' | 'tinta'
  daily_consumption: number
  lead_time_days: number
  image_url?: string | null
  updated_at: string
  created_at: string
}

export interface MachineEvent {
  id: string
  machine_id: string
  user_id: string | null
  event_type: 'occurrence' | 'part_change' | 'maintenance' | 'error'
  description: string
  image_url?: string
  inventory_item_id?: string | null
  quantity_used?: number
  created_at: string
  // joined
  machine?: Machine
  user?: Profile
}
