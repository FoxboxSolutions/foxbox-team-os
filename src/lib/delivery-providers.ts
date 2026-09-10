// ─── Delivery Provider Registry ──────────────────────────────
// Central configuration for all supported delivery companies.
// This file defines the UI metadata and credential requirements for each provider.
// Actual API credentials stay on the backend as Worker env secrets.

export interface ProviderCredentialField {
  type: 'api_key' | 'api_token' | 'client_id' | 'client_secret' | 'username' | 'password' | 'account_id' | 'store_id';
  label: string;
  placeholder: string;
  required: boolean;
}

export interface DeliveryProviderConfig {
  id: string;
  name: string;
  logo: string; // emoji or SVG path
  description: string;
  credentialFields: ProviderCredentialField[];
  hasApi: boolean; // whether a real API integration exists
  color: string; // accent color for the card
}

export const DELIVERY_PROVIDER_REGISTRY: DeliveryProviderConfig[] = [
  {
    id: 'ecom_delivery',
    name: 'ECOM DELIVERY',
    logo: '📦',
    description: 'E-Com Delivery Algeria — full API integration with colis tracking, webhooks, and bordereau generation.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'api_token', label: 'API Token', placeholder: 'Enter API token', required: true },
    ],
    hasApi: true,
    color: '#3b82f6',
  },
  {
    id: 'trdelivery',
    name: 'TRDELIVERY',
    logo: '🚚',
    description: 'TR Delivery — Algerian delivery company with stop desk and home delivery services.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'api_token', label: 'API Token', placeholder: 'Enter API token', required: true },
    ],
    hasApi: false,
    color: '#f59e0b',
  },
  {
    id: 'redex',
    name: 'REDEX ECOTRACK',
    logo: '🔴',
    description: 'Redex Ecotrack — express delivery and logistics across Algeria.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'api_token', label: 'API Token', placeholder: 'Enter API token', required: true },
    ],
    hasApi: false,
    color: '#ef4444',
  },
  {
    id: 'expedia_chrono',
    name: 'EXPEDIA CHRONO',
    logo: '⏱️',
    description: 'Expedia Chrono — chrono and standard delivery services.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'client_secret', label: 'Client Secret', placeholder: 'Enter client secret', required: true },
    ],
    hasApi: false,
    color: '#8b5cf6',
  },
  {
    id: 'zr_express',
    name: 'ZR EXPRESS',
    logo: '🟡',
    description: 'ZR Express — delivery and logistics services across Algeria.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'api_token', label: 'API Token', placeholder: 'Enter API token', required: true },
    ],
    hasApi: false,
    color: '#eab308',
  },
  {
    id: 'abex',
    name: 'ABEX',
    logo: '📬',
    description: 'ABEX — delivery services with nationwide coverage.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'api_token', label: 'API Token', placeholder: 'Enter API token', required: true },
    ],
    hasApi: false,
    color: '#06b6d4',
  },
  {
    id: 'maystroo',
    name: 'MAYSTROO',
    logo: '🏗️',
    description: 'Maystroo — delivery and fulfillment services.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
    ],
    hasApi: false,
    color: '#10b981',
  },
  {
    id: 'allo_express',
    name: 'ALLO EXPRESS',
    logo: '📱',
    description: 'Allo Express — fast delivery service for e-commerce.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'api_token', label: 'API Token', placeholder: 'Enter API token', required: true },
    ],
    hasApi: false,
    color: '#f97316',
  },
  {
    id: 'yalidine',
    name: 'YALIDINE',
    logo: '📦',
    description: 'Yalidine — one of Algeria\'s largest delivery networks with extensive stop desk coverage.',
    credentialFields: [
      { type: 'api_key', label: 'API Key', placeholder: 'Enter API key', required: true },
      { type: 'api_token', label: 'API Token', placeholder: 'Enter API token', required: true },
    ],
    hasApi: false,
    color: '#6366f1',
  },
];

export function getProviderConfig(id: string): DeliveryProviderConfig | undefined {
  return DELIVERY_PROVIDER_REGISTRY.find(p => p.id === id);
}
