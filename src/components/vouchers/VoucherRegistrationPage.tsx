import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Ticket,
  Wifi,
} from 'lucide-react';
import { VoucherDeviceType, WifiVoucherSubmission } from '../../types/cmms';
import { OFFICIAL_BRANCH_LOCATIONS } from '../../utils/helpdeskTickets';
import { submitPublicVoucherRegistration } from '../../services/voucherSubmissions';

const TARGET_REDIRECT_URL = 'https://tristellarcorp.com/';

const DEPARTMENTS = [
  'OPERATION',
  'SALES & MARKETING',
  'FINANCE / ACCOUNTING',
  'HUMAN RESOURCE',
  'EXECUTIVE',
  'IT DEPARTMENT',
  'WAREHOUSE / LOGISTICS',
  'OTHER',
];

function readQueryPrefills() {
  try {
    const params = new URLSearchParams(window.location.search);
    const voucherCode = (
      params.get('voucher') ||
      params.get('voucherCode') ||
      params.get('voucher_code') ||
      params.get('code') ||
      ''
    ).trim();

    const macAddress = (
      params.get('mac') ||
      params.get('client_mac') ||
      params.get('clientMac') ||
      params.get('usermac') ||
      ''
    ).trim();

    const rawBranch = (
      params.get('branch') ||
      params.get('location') ||
      params.get('ap') ||
      params.get('ssid') ||
      ''
    )
      .trim()
      .toUpperCase();

    const matchedBranch =
      OFFICIAL_BRANCH_LOCATIONS.find(
        (b) => rawBranch && (b.includes(rawBranch) || rawBranch.includes(b.split(' ')[0]))
      ) || OFFICIAL_BRANCH_LOCATIONS[0];

    const rawGroup = (params.get('group') || params.get('type') || '')
      .trim()
      .toUpperCase();
    const userGroup: 'Employee' | 'GUEST' =
      rawGroup === 'GUEST' ? 'GUEST' : 'Employee';

    return { voucherCode, macAddress, matchedBranch, userGroup };
  } catch {
    return {
      voucherCode: '',
      macAddress: '',
      matchedBranch: OFFICIAL_BRANCH_LOCATIONS[0],
      userGroup: 'Employee' as const,
    };
  }
}

export const VoucherRegistrationPage: React.FC = () => {
  const prefills = useMemo(() => readQueryPrefills(), []);

  const [voucherCode, setVoucherCode] = useState(prefills.voucherCode);
  const [userGroup, setUserGroup] = useState<'Employee' | 'GUEST'>(prefills.userGroup);
  const [fullName, setFullName] = useState('');
  const [branchLocation, setBranchLocation] = useState<string>(prefills.matchedBranch);
  const [department, setDepartment] = useState(
    prefills.userGroup === 'GUEST' ? '' : 'OPERATION'
  );
  const [deviceType, setDeviceType] = useState<VoucherDeviceType>(
    prefills.userGroup === 'GUEST' ? 'Guest Device' : 'Company Laptop'
  );
  const [alias, setAlias] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGroupChange = (nextGroup: 'Employee' | 'GUEST') => {
    setUserGroup(nextGroup);
    if (nextGroup === 'GUEST') {
      setDeviceType('Guest Device');
      if (DEPARTMENTS.includes(department)) {
        setDepartment('');
      }
    } else {
      if (deviceType === 'Guest Device') {
        setDeviceType('Company Laptop');
      }
      if (!department) {
        setDepartment('OPERATION');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = voucherCode.trim();
    const cleanName = fullName.trim();

    if (cleanCode.length < 3) {
      setErrorMsg('Please enter your Ruijie Wi-Fi voucher ID.');
      return;
    }
    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setSubmitting(true);

    const submission: WifiVoucherSubmission = {
      id: `wvs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      voucherCode: cleanCode,
      fullName: cleanName,
      employeeNumber: '',
      userGroup,
      department: department.trim(),
      branchLocation,
      deviceType,
      alias: alias.trim(),
      phoneNumber: phoneNumber.trim(),
      macAddress: prefills.macAddress || undefined,
      submittedAt: new Date().toISOString(),
    };

    try {
      await submitPublicVoucherRegistration(submission);
    } finally {
      setSubmitting(false);
      setRedirecting(true);
      window.setTimeout(() => {
        try {
          window.location.replace(TARGET_REDIRECT_URL);
        } catch {
          window.location.href = TARGET_REDIRECT_URL;
        }
      }, 650);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-between px-4 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto my-auto space-y-5">
        {/* Clean Brand Header — No Tabs or Navigation Links */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="inline-flex items-center justify-center rounded-xl bg-white px-3.5 py-2 border border-stone-200 dark:border-stone-800 shadow-xs">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/TTC.Logo.Tagline_MKT_Ver7824_3b47c9b8.png`}
              alt="TriStellar — Bigas ng Bayan"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              <Wifi className="w-3.5 h-3.5" />
              <span>Ruijie Wi-Fi Access Registration</span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-1">
              Wi-Fi Voucher User Information
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md">
              Please enter your voucher ID and device details to finish network check-in.
            </p>
          </div>
        </div>

        {/* Form or Redirecting Confirmation */}
        {redirecting ? (
          <div className="bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-8 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Registration Complete
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-300">
              Voucher <span className="font-mono font-bold">{voucherCode.trim()}</span> has been recorded for{' '}
              <strong>{fullName.trim()}</strong>.
            </p>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-orange-600 dark:text-orange-400 pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Redirecting to tristellarcorp.com...</span>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
          >
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* User Group Toggle */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Access Type
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
                <button
                  type="button"
                  onClick={() => handleGroupChange('Employee')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    userGroup === 'Employee'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={() => handleGroupChange('GUEST')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    userGroup === 'GUEST'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  Guest / Visitor
                </button>
              </div>
            </div>

            {/* Voucher ID & Branch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="voucher-code-input"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  Voucher ID *
                </label>
                <div className="relative">
                  <Ticket className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="voucher-code-input"
                    type="text"
                    required
                    autoComplete="off"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="e.g. dmpykf"
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-mono font-semibold rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="branch-select"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  Branch / Location *
                </label>
                <select
                  id="branch-select"
                  required
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                >
                  {OFFICIAL_BRANCH_LOCATIONS.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Full Name & Department / Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="full-name-input"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  {userGroup === 'Employee' ? 'Employee Full Name *' : 'Visitor Full Name *'}
                </label>
                <input
                  id="full-name-input"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={
                    userGroup === 'Employee' ? 'First Name Last Name' : 'Your full name'
                  }
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              {userGroup === 'Employee' ? (
                <div>
                  <label
                    htmlFor="department-select"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Department *
                  </label>
                  <select
                    id="department-select"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="guest-company-input"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Company / Purpose of Visit *
                  </label>
                  <input
                    id="guest-company-input"
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Supplier Meeting / Client"
                    className="w-full px-3 py-2.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>
              )}
            </div>

            {/* Device Type & Alias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="device-type-select"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  Device Type *
                </label>
                <select
                  id="device-type-select"
                  required
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as VoucherDeviceType)}
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                >
                  <option value="Company Laptop">Company Laptop</option>
                  <option value="Company Phone">Company Phone</option>
                  <option value="Personal Phone">Personal Phone</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Guest Device">Guest Device</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="device-alias-input"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  Device Label / Model
                </label>
                <input
                  id="device-alias-input"
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g. ThinkPad / iPhone / Tablet"
                  className="w-full px-3 py-2.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Contact Number */}
            <div>
              <label
                htmlFor="phone-input"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
              >
                Mobile / Contact Number (Optional)
              </label>
              <input
                id="phone-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 0917 123 4567"
                className="w-full px-3 py-2.5 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              />
            </div>

            {prefills.macAddress && (
              <div className="px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                <span>Detected Device MAC</span>
                <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
                  {prefills.macAddress}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Information...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit &amp; Continue to TriStellar</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-[11px] text-stone-400 dark:text-stone-500 pt-6">
        TRISTELLAR IT DEPT. · Wi-Fi Network Access Registration
      </p>
    </div>
  );
};
