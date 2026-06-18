"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type Role,
  type AttendanceState,
  type InvitationStatus,
  type InquiryStatus,
  type UserStatus,
  type User,
  type Invitation,
  type Inquiry,
  type Cohort,
  getUser,
  defaultUserForRole,
} from "@/lib/account";

export type ToastTone = "positive" | "warning" | "negative";

interface Toast {
  msg: string;
  tone: ToastTone;
}

interface ConfirmConfig {
  title: string;
  body: string;
  confirmLabel: string;
  tone: "negative" | "info" | "warning";
  onConfirm: () => void;
}

interface AppStateValue {
  role: Role | null;
  userId: string | null;
  me: User | null;
  signInAs: (role: Role) => void;
  signOut: () => void;

  selectedCohortId: string;
  setSelectedCohortId: (id: string) => void;
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (id: string | null) => void;
  selectedInquiryId: string | null;
  setSelectedInquiryId: (id: string | null) => void;
  selectedLessonId: string | null;
  setSelectedLessonId: (id: string | null) => void;

  // effective status (mock overrides layered over seed data)
  userStatusOf: (u: User) => UserStatus;
  invStatusOf: (iv: Invitation) => InvitationStatus;
  inqStatusOf: (iq: Inquiry) => InquiryStatus;
  cohortCurrentLessonId: (c: Cohort) => string | null;
  attendanceOf: (cohortId: string, userId: string, fallback: AttendanceState) => AttendanceState;

  // mutations (prototype only — no persistence beyond this session)
  suspendUser: (id: string) => void;
  restoreUser: (id: string) => void;
  setInvStatus: (id: string, status: InvitationStatus) => void;
  setInqStatus: (id: string, status: InquiryStatus) => void;
  setAttendance: (cohortId: string, userId: string, state: AttendanceState) => void;
  advanceCohortLesson: (cohortId: string, nextLessonId: string | null) => void;

  toast: Toast | null;
  showToast: (msg: string, tone?: ToastTone) => void;

  confirm: ConfirmConfig | null;
  askConfirm: (cfg: ConfirmConfig) => void;
  confirmYes: () => void;
  confirmNo: () => void;
}

const Ctx = createContext<AppStateValue | null>(null);

const STORAGE_KEY = "bow.app.session";

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [selectedCohortId, setSelectedCohortId] = useState("coh-1");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [userStatusOverride, setUserStatusOverride] = useState<Record<string, UserStatus>>({});
  const [invStatusOverride, setInvStatusOverride] = useState<Record<string, InvitationStatus>>({});
  const [inqStatusOverride, setInqStatusOverride] = useState<Record<string, InquiryStatus>>({});
  const [cohortLessonOverride, setCohortLessonOverride] = useState<Record<string, string>>({});
  const [attendance, setAttendanceMap] = useState<Record<string, Record<string, AttendanceState>>>({});

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Restore the persisted session on mount. This is a legitimate on-mount sync
  // from an external store (localStorage); doing it in an initializer would
  // mismatch the SSR render and break hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { role: Role | null; userId: string | null };
        if (parsed.role) {
          setRole(parsed.role);
          setUserId(parsed.userId);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ role, userId }));
    } catch {
      /* ignore */
    }
  }, [role, userId, hydrated]);

  const signInAs = useCallback((r: Role) => {
    setRole(r);
    setUserId(defaultUserForRole(r));
    setSelectedCohortId("coh-1");
    setSelectedLessonId(null);
  }, []);

  const signOut = useCallback(() => {
    setRole(null);
    setUserId(null);
  }, []);

  const showToast = useCallback((msg: string, tone: ToastTone = "positive") => {
    setToast({ msg, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const askConfirm = useCallback((cfg: ConfirmConfig) => setConfirm(cfg), []);
  const confirmNo = useCallback(() => setConfirm(null), []);
  const confirmYes = useCallback(() => {
    setConfirm((c) => {
      c?.onConfirm();
      return null;
    });
  }, []);

  const suspendUser = useCallback((id: string) => {
    setUserStatusOverride((m) => ({ ...m, [id]: "suspended" }));
    showToast("Access suspended", "negative");
  }, [showToast]);

  const restoreUser = useCallback((id: string) => {
    setUserStatusOverride((m) => ({ ...m, [id]: "active" }));
    showToast("Access restored");
  }, [showToast]);

  const setInvStatus = useCallback((id: string, status: InvitationStatus) => {
    setInvStatusOverride((m) => ({ ...m, [id]: status }));
    showToast("Invitation " + status, status === "revoked" ? "negative" : "positive");
  }, [showToast]);

  const setInqStatus = useCallback((id: string, status: InquiryStatus) => {
    setInqStatusOverride((m) => ({ ...m, [id]: status }));
    showToast("Inquiry marked " + status);
  }, [showToast]);

  const setAttendance = useCallback((cohortId: string, uid: string, state: AttendanceState) => {
    setAttendanceMap((m) => ({ ...m, [cohortId]: { ...(m[cohortId] ?? {}), [uid]: state } }));
  }, []);

  const advanceCohortLesson = useCallback((cohortId: string, nextLessonId: string | null) => {
    if (!nextLessonId) {
      showToast("This is the final lesson", "warning");
      return;
    }
    setCohortLessonOverride((m) => ({ ...m, [cohortId]: nextLessonId }));
    showToast("Cohort advanced to the next lesson");
  }, [showToast]);

  const value: AppStateValue = useMemo(
    () => ({
      role,
      userId,
      me: getUser(userId),
      signInAs,
      signOut,
      selectedCohortId,
      setSelectedCohortId,
      selectedStudentId,
      setSelectedStudentId,
      selectedOrganizationId,
      setSelectedOrganizationId,
      selectedInquiryId,
      setSelectedInquiryId,
      selectedLessonId,
      setSelectedLessonId,
      userStatusOf: (u) => userStatusOverride[u.id] ?? u.status,
      invStatusOf: (iv) => invStatusOverride[iv.id] ?? iv.status,
      inqStatusOf: (iq) => inqStatusOverride[iq.id] ?? iq.status,
      cohortCurrentLessonId: (c) => cohortLessonOverride[c.id] ?? c.currentLessonId,
      attendanceOf: (cohortId, uid, fallback) => attendance[cohortId]?.[uid] ?? fallback,
      suspendUser,
      restoreUser,
      setInvStatus,
      setInqStatus,
      setAttendance,
      advanceCohortLesson,
      toast,
      showToast,
      confirm,
      askConfirm,
      confirmYes,
      confirmNo,
    }),
    [
      role, userId, selectedCohortId, selectedStudentId, selectedOrganizationId, selectedInquiryId,
      selectedLessonId, userStatusOverride, invStatusOverride, inqStatusOverride, cohortLessonOverride,
      attendance, toast, confirm, signInAs, signOut, showToast, askConfirm, confirmYes, confirmNo,
      suspendUser, restoreUser, setInvStatus, setInqStatus, setAttendance, advanceCohortLesson,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
