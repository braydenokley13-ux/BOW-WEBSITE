"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
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
  type AppData,
} from "@/lib/account";
import { signOut as signOutAction } from "@/app/actions/auth";
import * as lms from "@/app/actions/lms";

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
  role: Role;
  me: User;
  signOut: () => void;

  /** Live dataset loaded from the database on the server. */
  data: AppData;
  /** Invitations including any created this session (newest first). */
  invitations: Invitation[];
  /** Inquiries (newest first). */
  inquiries: Inquiry[];

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

  // effective status — database snapshot with optimistic overrides layered on top
  userStatusOf: (u: User) => UserStatus;
  invStatusOf: (iv: Invitation) => InvitationStatus;
  inqStatusOf: (iq: Inquiry) => InquiryStatus;
  cohortCurrentLessonId: (c: Cohort) => string | null;
  attendanceOf: (cohortId: string, userId: string, fallback: AttendanceState) => AttendanceState;

  // mutations — optimistic locally, persisted to the database via server actions
  suspendUser: (id: string) => void;
  restoreUser: (id: string) => void;
  setInvStatus: (id: string, status: InvitationStatus) => void;
  setInqStatus: (id: string, status: InquiryStatus) => void;
  setAttendance: (cohortId: string, userId: string, state: AttendanceState) => void;
  advanceCohortLesson: (cohortId: string, nextLessonId: string | null) => void;
  createInvitation: (input: lms.NewInvitationInput) => void;

  toast: Toast | null;
  showToast: (msg: string, tone?: ToastTone) => void;

  confirm: ConfirmConfig | null;
  askConfirm: (cfg: ConfirmConfig) => void;
  confirmYes: () => void;
  confirmNo: () => void;
}

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({
  me,
  data,
  children,
}: {
  me: User;
  data: AppData;
  children: React.ReactNode;
}) {
  const role = me.role;

  const [selectedCohortId, setSelectedCohortId] = useState("coh-1");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Optimistic overlays so the UI responds instantly; the same change is
  // also written to the database, so a reload shows the persisted value.
  const [userStatusOverride, setUserStatusOverride] = useState<Record<string, UserStatus>>({});
  const [invStatusOverride, setInvStatusOverride] = useState<Record<string, InvitationStatus>>({});
  const [inqStatusOverride, setInqStatusOverride] = useState<Record<string, InquiryStatus>>({});
  const [cohortLessonOverride, setCohortLessonOverride] = useState<Record<string, string>>({});
  const [attendance, setAttendanceMap] = useState<Record<string, Record<string, AttendanceState>>>({});
  const [newInvitations, setNewInvitations] = useState<Invitation[]>([]);

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Index the snapshot for O(1) effective-status lookups.
  const dbUserStatus = useMemo(() => {
    const m: Record<string, UserStatus> = {};
    for (const u of data.users) m[u.id] = u.status;
    return m;
  }, [data.users]);
  const dbInvStatus = useMemo(() => {
    const m: Record<string, InvitationStatus> = {};
    for (const iv of data.invitations) m[iv.id] = iv.status;
    return m;
  }, [data.invitations]);
  const dbInqStatus = useMemo(() => {
    const m: Record<string, InquiryStatus> = {};
    for (const iq of data.inquiries) m[iq.id] = iq.status;
    return m;
  }, [data.inquiries]);
  const dbCohortLesson = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const c of data.cohorts) m[c.id] = c.currentLessonId;
    return m;
  }, [data.cohorts]);

  const signOut = useCallback(() => {
    void signOutAction();
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

  const failToast = useCallback((msg: string) => () => showToast(msg, "negative"), [showToast]);

  const suspendUser = useCallback((id: string) => {
    setUserStatusOverride((m) => ({ ...m, [id]: "suspended" }));
    showToast("Access suspended", "negative");
    lms.suspendUser(id).catch(failToast("Couldn't suspend — try again"));
  }, [showToast, failToast]);

  const restoreUser = useCallback((id: string) => {
    setUserStatusOverride((m) => ({ ...m, [id]: "active" }));
    showToast("Access restored");
    lms.restoreUser(id).catch(failToast("Couldn't restore — try again"));
  }, [showToast, failToast]);

  const setInvStatus = useCallback((id: string, status: InvitationStatus) => {
    setInvStatusOverride((m) => ({ ...m, [id]: status }));
    showToast("Invitation " + status, status === "revoked" ? "negative" : "positive");
    lms.setInvitationStatus(id, status).catch(failToast("Couldn't update invitation"));
  }, [showToast, failToast]);

  const setInqStatus = useCallback((id: string, status: InquiryStatus) => {
    setInqStatusOverride((m) => ({ ...m, [id]: status }));
    showToast("Inquiry marked " + status);
    lms.setInquiryStatus(id, status).catch(failToast("Couldn't update inquiry"));
  }, [showToast, failToast]);

  const setAttendance = useCallback((cohortId: string, uid: string, state: AttendanceState) => {
    setAttendanceMap((m) => ({ ...m, [cohortId]: { ...(m[cohortId] ?? {}), [uid]: state } }));
    lms.setAttendance(cohortId, uid, state).catch(failToast("Couldn't save attendance"));
  }, [failToast]);

  const advanceCohortLesson = useCallback((cohortId: string, nextLessonId: string | null) => {
    if (!nextLessonId) {
      showToast("This is the final lesson", "warning");
      return;
    }
    setCohortLessonOverride((m) => ({ ...m, [cohortId]: nextLessonId }));
    showToast("Cohort advanced to the next lesson");
    lms.advanceCohortLesson(cohortId, nextLessonId).catch(failToast("Couldn't advance cohort"));
  }, [showToast, failToast]);

  const createInvitation = useCallback((input: lms.NewInvitationInput) => {
    lms.createInvitation(input)
      .then((inv) => {
        setNewInvitations((list) => [inv, ...list]);
        showToast("Invitation created");
      })
      .catch(failToast("Couldn't create invitation"));
  }, [showToast, failToast]);

  const invitations = useMemo(
    () => [...newInvitations, ...data.invitations],
    [newInvitations, data.invitations],
  );

  const value: AppStateValue = useMemo(
    () => ({
      role,
      me,
      signOut,
      data,
      invitations,
      inquiries: data.inquiries,
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
      userStatusOf: (u) => userStatusOverride[u.id] ?? dbUserStatus[u.id] ?? u.status,
      invStatusOf: (iv) => invStatusOverride[iv.id] ?? dbInvStatus[iv.id] ?? iv.status,
      inqStatusOf: (iq) => inqStatusOverride[iq.id] ?? dbInqStatus[iq.id] ?? iq.status,
      cohortCurrentLessonId: (c) =>
        cohortLessonOverride[c.id] ?? dbCohortLesson[c.id] ?? c.currentLessonId,
      attendanceOf: (cohortId, uid, fallback) =>
        attendance[cohortId]?.[uid] ?? data.attendance[cohortId]?.[uid] ?? fallback,
      suspendUser,
      restoreUser,
      setInvStatus,
      setInqStatus,
      setAttendance,
      advanceCohortLesson,
      createInvitation,
      toast,
      showToast,
      confirm,
      askConfirm,
      confirmYes,
      confirmNo,
    }),
    [
      role, me, signOut, data, invitations, selectedCohortId, selectedStudentId, selectedOrganizationId,
      selectedInquiryId, selectedLessonId, userStatusOverride, invStatusOverride, inqStatusOverride,
      cohortLessonOverride, attendance, dbUserStatus, dbInvStatus, dbInqStatus, dbCohortLesson,
      toast, confirm, showToast, askConfirm, confirmYes, confirmNo, suspendUser, restoreUser,
      setInvStatus, setInqStatus, setAttendance, advanceCohortLesson, createInvitation,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
