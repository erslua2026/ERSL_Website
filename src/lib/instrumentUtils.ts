import type { InstrumentStatus } from '../types';

export interface InstrumentStatusMeta {
  value: InstrumentStatus;
  label: string;
  bannerLabel: string;
  dotClass: string;
  textClass: string;
  headerBadgeClass: string;
  alertBoxClass: string;
}

export const INSTRUMENT_STATUS_OPTIONS: InstrumentStatusMeta[] = [
  {
    value: 'field-ready',
    label: 'Field Ready',
    bannerLabel: 'Calibrated · Field Ready',
    dotClass: 'bg-green-500',
    textClass: 'text-green-600',
    headerBadgeClass: 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100',
    alertBoxClass: '',
  },
  {
    value: 'under-repair',
    label: 'Under Repair',
    bannerLabel: 'Under Repair / Maintenance',
    dotClass: 'bg-amber-500 animate-pulse',
    textClass: 'text-amber-700',
    headerBadgeClass: 'border-amber-300/60 bg-amber-500/30 text-amber-50',
    alertBoxClass: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  {
    value: 'calibration',
    label: 'In Calibration',
    bannerLabel: 'In Calibration / Testing',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700',
    headerBadgeClass: 'border-sky-300/50 bg-sky-500/25 text-sky-50',
    alertBoxClass: 'bg-sky-50 border-sky-200 text-sky-900',
  },
  {
    value: 'offline',
    label: 'Out of Service',
    bannerLabel: 'Out of Service',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600',
    headerBadgeClass: 'border-rose-300/60 bg-rose-900/50 text-rose-100',
    alertBoxClass: 'bg-red-50 border-red-200 text-red-900',
  },
];

export function getInstrumentStatusMeta(status?: InstrumentStatus): InstrumentStatusMeta {
  return (
    INSTRUMENT_STATUS_OPTIONS.find(opt => opt.value === status) ||
    INSTRUMENT_STATUS_OPTIONS[0]
  );
}
