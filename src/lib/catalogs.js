export const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "bank", label: "Bank transfer" },
  { id: "card", label: "Card" },
  { id: "mobile_money", label: "Mobile money" },
];

export const INCOME_ACCOUNTS = [
  { code: "4000", label: "Room revenue" },
  { code: "4100", label: "Restaurant revenue" },
  { code: "4200", label: "Service revenue" },
  { code: "4300", label: "Laundry revenue" },
  { code: "4400", label: "Conference revenue" },
  { code: "4500", label: "Transportation revenue" },
  { code: "4900", label: "Other income" },
];

export const EXPENSE_ACCOUNTS = [
  { code: "5000", label: "Salaries" },
  { code: "5100", label: "Electricity" },
  { code: "5110", label: "Water" },
  { code: "5120", label: "Internet" },
  { code: "5200", label: "Food and beverage" },
  { code: "5300", label: "Hotel supplies" },
  { code: "5400", label: "Maintenance" },
  { code: "5500", label: "Rent" },
  { code: "5600", label: "Marketing" },
  { code: "5700", label: "Transportation" },
  { code: "5900", label: "Other expenses" },
];

export const CUSTOMER_KINDS = [
  { id: "individual", label: "Individual" },
  { id: "company", label: "Company" },
  { id: "organization", label: "Organization" },
  { id: "travel_agency", label: "Travel agency" },
  { id: "corporate", label: "Corporate" },
];

export const ROLES = [
  { id: "super_admin", label: "Super Administrator" },
  { id: "hotel_manager", label: "Hotel Manager" },
  { id: "receptionist", label: "Receptionist" },
  { id: "accountant", label: "Accountant" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "hr_admin", label: "HR / Admin" },
];

export const DEMO_ACCOUNTS = [
  ["Amina Yusuf", "admin@mhmas.so", "Admin@123", "Super Administrator"],
  ["Hassan Ali", "manager@mhmas.so", "Manager@123", "Hotel Manager"],
  ["Hodan Mohamed", "reception@mhmas.so", "Reception@123", "Receptionist"],
  ["Abdi Nur", "accountant@mhmas.so", "Accountant@123", "Accountant"],
  ["Fadumo Warsame", "house@mhmas.so", "House@123", "Housekeeping"],
  ["Sahra Omar", "hr@mhmas.so", "Hr@123", "HR / Admin"],
];
