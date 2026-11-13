import type {
  AccountStatus, AssetCategory, AssetStatus, EmployeeStatus, HrRequestStatus, HrRequestType,
} from "@prisma/client";

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  LAPTOP: "Laptop", DESKTOP: "Desktop", MONITOR: "Monitor", PHONE: "Phone", TABLET: "Tablet",
  PRINTER: "Printer", NETWORK: "Network device", PERIPHERAL: "Peripheral", OTHER: "Other",
};

export const CATEGORY_CODES: Record<AssetCategory, string> = {
  LAPTOP: "LT", DESKTOP: "DT", MONITOR: "MN", PHONE: "PH", TABLET: "TB",
  PRINTER: "PR", NETWORK: "NW", PERIPHERAL: "PE", OTHER: "OT",
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  IN_STOCK: "In stock", ASSIGNED: "Assigned", UNDER_REPAIR: "Under repair",
  RETIRED: "Retired", LOST_STOLEN: "Lost / stolen",
};

export const ASSET_STATUS_STYLES: Record<AssetStatus, string> = {
  IN_STOCK: "bg-brand-teal-light text-brand-teal-dark",
  ASSIGNED: "bg-brand-plum-light text-brand-plum",
  UNDER_REPAIR: "bg-amber-100 text-amber-800",
  RETIRED: "bg-slate-200 text-slate-600",
  LOST_STOLEN: "bg-red-100 text-red-700",
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = { ACTIVE: "Active", LEFT: "Left" };

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: "Active", DISABLED: "Disabled", DELETED: "Deleted",
};

export const REQUEST_TYPE_LABELS: Record<HrRequestType, string> = {
  JOINER: "New joiner", LEAVER: "Leaver", ASSET_ALLOCATION: "Asset allocation", ASSET_RETURN: "Asset return",
};

export const REQUEST_TYPE_DATE_LABEL: Record<HrRequestType, string> = {
  JOINER: "Start date", LEAVER: "Last working day", ASSET_ALLOCATION: "Needed by", ASSET_RETURN: "Return by",
};

export const REQUEST_STATUS_LABELS: Record<HrRequestStatus, string> = {
  SUBMITTED: "Submitted", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export const REQUEST_STATUS_STYLES: Record<HrRequestStatus, string> = {
  SUBMITTED: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-brand-teal-light text-brand-teal-dark",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-600",
};

/** Systems offered when recording an employee's accounts (free text allowed). */
export const DEFAULT_SYSTEMS = [
  "Email (Roundcube)", "Windows / domain login", "Dental practice software",
  "Shared drive", "Wi-Fi", "Printer / scanner", "Other",
];
