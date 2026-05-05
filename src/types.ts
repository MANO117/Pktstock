export type MaterialType = string;

export interface Material {
  id: string;
  name: string;
  unit: string;
}

export interface SchemeMaterialStage {
  stageNumber: number;
  quantity: number;
  description?: string;
}

export interface Scheme {
  id: string;
  name: string;
  year: string;
  materialStages?: {
    [key: string]: SchemeMaterialStage[];
  };
}

export interface Overseer {
  id: string;
  name: string;
}

export interface Panchayat {
  id: string;
  name: string;
  overseerId: string;
}

export interface Beneficiary {
  id: string;
  name: string;
  panchayatId: string;
  schemeId: string;
  year: string;
}

export interface StockTransaction {
  id: string;
  date: string;
  type: 'RECEIPT' | 'ISSUE';
  material: MaterialType;
  quantity: number;
  schemeId: string;
  panchayatId?: string;
  beneficiaryId?: string;
  invoiceNo?: string;
  invoiceUrl?: string; // Simulated
  notes?: string;
  stage?: number;
  timestamp: string;
}

export interface SystemUser {
  id: string;
  username: string;
  password?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  role: 'ADMIN' | 'USER';
  requestedAt: string;
}

export interface DailyBalance {
  date: string;
  material: MaterialType;
  openingBalance: number;
  receipts: number;
  issues: number;
  closingBalance: number;
}
