"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type Role,
  type AttendanceState,
  type InvitationStatus,
  type InquiryStatus,
  type UserStatus,
  type User,
  type Organization,
  type Cohort,
  type Enrollment,
  type Invitation,
  type Inquiry,
  type LessonProgressDetail,
  type SessionNote,
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

export type RosterEntry = Enrollment & { user: User };

interface AppStateValue {
  role: Role;
  me: User;
  signOut: () => void;

  /** Live dataset loaded from the database on the server. */
  data: AppData;
  invitations: Invitation[];
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

  // ---- DB-bound lookups (read from the live snapshot) ----
  getUser: (id: string | null) => User | null;
  getOrg: (id: string | null) => Organization | null;
  getCohort: (id: string | null) => Cohort | null;
  cohortRoster: (cohortId: string) => RosterEntry[];
  cohortsForInstructor: (uid: string) => Cohort[];
  activeEnrollmentFor: (uid: string) => Enrollment | null;
  lessonProgressFor: (uid: string, lessonId: string) => LessonProgressDetail | null;
  notesForCohort: (cohortId: string) => SessionNote[];

  // effective status — database snapshot with optimistic overrides layered on top
  userStatusOf: (u: User) => UserStatus;
  invStatusOf: (iv: Invitation) => InvitationStatus;
  inqStatusOf: (iq: Inquiry) => InquiryStatus;
  cohortCurrentLessonId: (c: Cohort) => string | null;
  attendanceOf: (cohortId: string, userId: string, fallback: AttendanceState) => AttendanceState;

  // ---- mutations ----
  // status toggles: optimistic + persisted
  suspendUser: (id: string) => void;
  restoreUser: (id: string) => void;
  setInvStatus: (id: string, status: InvitationStatus) => void;
  setInqStatus: (id: string, status: InquiryStatus) => void;
  setAttendance: (cohortId: string, userId: string, state: AttendanceState) => void;
  advanceCohortLesson: (cohortId: string, nextLessonId: string | null) => void;
  // structural: persisted then re-pulled via router.refresh()
  createInvitation: (input: lms.NewInvitationInput) => void;
  createCohort: (input: lms.NewCohortInput) => void;
  createOrganization: (input: lms.NewOrganizationInput) => void;
  assignInstructor: (cohortId: string, instructorId: string | null) => void;
  assignStudent: (cohortId: string, userId: string) => void;
  removeStudent: (cohortId: string, userId: string) => void;
  transferStudent: (userId: string, fromCohortId: string, toCohortId: string) => void;
  addSessionNote: (cohortId: string, scope: string, text: string) => void;
  requestAccountDeletion: () => void;
  dismissDeletionRequest: (userId: string) => void;
  // student progress
  startLesson: (lessonId: string) => void;
  setSimulationDone: (lessonId: string, done: boolean) => void;
  saveReflection: (lessonId: string, text: string) => void;
  setChallengeDone: (lessonId: string, done: boolean) => void;
  completeLesson: (lessonId: string) => void;

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
  const router = useRouter();

  const [selectedCohortId, setSelectedCohortId] = useState("coh-1");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Optimistic overlays for high-frequency status toggles so the UI responds
  // instantly; the same change is also written to the database.
  const [userStatusOverride, setUserStatusOverride] = useState<Record<string, UserStatus>>({});
  const [invStatusOverride, setInvStatusOverride] = useState<Record<string, InvitationStatus>>({});
  const [inqStatusOverride, setInqStatusOverride] = useState<Record<string, InquiryStatus>>({});
  const [cohortLessonOverride, setCohortLessonOverride] = useState<Record<string, string>>({});
  const [attendance, setAttendanceMap] = useState<Record<string, Record<string, AttendanceState>>>({});

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

  // Run a structural mutation: persist, then re-pull the server snapshot.
  const run = useCallback(
    (p: Promise<unknown>, okMsg?: string, failMsg = "Something went wrong — try again") => {
      p.then(() => {
        if (okMsg) showToast(okMsg);
        router.refresh();
      }).catch(() => showToast(failMsg, "negative"));
    },
    [router, showToast],
  );

  /* ---- optimistic status toggles ---- */
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

  /* ---- structural mutations (persist + refresh) ---- */
  const createInvitation = useCallback((input: lms.NewInvitationInput) => {
    run(lms.createInvitation(input), "Invitation created", "Couldn't create invitation");
  }, [run]);

  const createCohort = useCallback((input: lms.NewCohortInput) => {
    run(lms.createCohort(input), "Cohort created as a draft", "Couldn't create cohort");
  }, [run]);

  const createOrganization = useCallback((input: lms.NewOrganizationInput) => {
    run(lms.createOrganization(input), "Organization created", "Couldn't create organization");
  }, [run]);

  const assignInstructor = useCallback((cohortId: string, instructorId: string | null) => {
    run(lms.assignInstructor(cohortId, instructorId), instructorId ? "Instructor assigned" : "Instructor removed", "Couldn't update instructor");
  }, [run]);

  const assignStudent = useCallback((cohortId: string, userId: string) => {
    run(lms.assignStudent(cohortId, userId), "Student added to cohort", "Couldn't add student");
  }, [run]);

  const removeStudent = useCallback((cohortId: string, userId: string) => {
    run(lms.removeStudent(cohortId, userId), "Student removed from cohort", "Couldn't remove student");
  }, [run]);

  const transferStudent = useCallback((userId: string, fromCohortId: string, toCohortId: string) => {
    run(lms.transferStudent(userId, fromCohortId, toCohortId), "Student transferred", "Couldn't transfer student");
  }, [run]);

  const addSessionNote = useCallback((cohortId: string, scope: string, text: string) => {
    run(lms.addSessionNote(cohortId, scope, text), "Note added — instructors and BOW only", "Couldn't add note");
  }, [run]);

  const requestAccountDeletion = useCallback(() => {
    run(lms.requestAccountDeletion(), "Deletion request sent to BOW administration", "Couldn't send request");
  }, [run]);

  const dismissDeletionRequest = useCallback((userId: string) => {
    run(lms.dismissDeletionRequest(userId), "Deletion request dismissed", "Couldn't dismiss request");
  }, [run]);

  /* ---- student progress ---- */
  const startLesson = useCallback((lessonId: string) => {
    run(lms.startLesson(lessonId), "Lesson started", "Couldn't start lesson");
  }, [run]);

  const setSimulationDone = useCallback((lessonId: string, done: boolean) => {
    run(lms.setSimulationDone(lessonId, done), done ? "Simulation marked complete" : undefined, "Couldn't update simulation");
  }, [run]);

  const saveReflection = useCallback((lessonId: string, text: string) => {
    run(lms.saveReflection(lessonId, text), "Reflection saved", "Couldn't save reflection");
  }, [run]);

  const setChallengeDone = useCallback((lessonId: string, done: boolean) => {
    run(lms.setChallengeDone(lessonId, done), done ? "Real-world challenge complete" : undefined, "Couldn't update challenge");
  }, [run]);

  const completeLesson = useCallback((lessonId: string) => {
    run(lms.completeLesson(lessonId), "Lesson completed", "Couldn't complete lesson");
  }, [run]);

  /* ---- lookups bound to the live snapshot ---- */
  const getUser = useCallback((id: string | null) => data.users.find((u) => u.id === id) ?? null, [data.users]);
  const getOrg = useCallback((id: string | null) => data.organizations.find((o) => o.id === id) ?? null, [data.organizations]);
  const getCohort = useCallback((id: string | null) => data.cohorts.find((c) => c.id === id) ?? null, [data.cohorts]);

  const cohortRoster = useCallback(
    (cohortId: string): RosterEntry[] =>
      data.enrollments
        .filter((e) => e.cohortId === cohortId && e.enroll !== "inactive")
        .map((e) => ({ ...e, user: data.users.find((u) => u.id === e.userId) }))
        .filter((e): e is RosterEntry => e.user !== undefined),
    [data.enrollments, data.users],
  );

  const cohortsForInstructor = useCallback(
    (uid: string) => data.cohorts.filter((c) => c.instructorId === uid),
    [data.cohorts],
  );

  const activeEnrollmentFor = useCallback(
    (uid: string): Enrollment | null =>
      data.enrollments.find((e) => e.userId === uid && e.enroll === "active") ??
      data.enrollments.find((e) => e.userId === uid && e.enroll !== "inactive") ??
      null,
    [data.enrollments],
  );

  const lessonProgressFor = useCallback(
    (uid: string, lessonId: string) => data.progress[uid]?.[lessonId] ?? null,
    [data.progress],
  );

  const notesForCohort = useCallback(
    (cohortId: string) => data.notes.filter((n) => n.cohortId === cohortId),
    [data.notes],
  );

  const value: AppStateValue = useMemo(
    () => ({
      role,
      me,
      signOut,
      data,
      invitations: data.invitations,
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
      getUser,
      getOrg,
      getCohort,
      cohortRoster,
      cohortsForInstructor,
      activeEnrollmentFor,
      lessonProgressFor,
      notesForCohort,
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
      createCohort,
      createOrganization,
      assignInstructor,
      assignStudent,
      removeStudent,
      transferStudent,
      addSessionNote,
      requestAccountDeletion,
      dismissDeletionRequest,
      startLesson,
      setSimulationDone,
      saveReflection,
      setChallengeDone,
      completeLesson,
      toast,
      showToast,
      confirm,
      askConfirm,
      confirmYes,
      confirmNo,
    }),
    [
      role, me, signOut, data, selectedCohortId, selectedStudentId, selectedOrganizationId,
      selectedInquiryId, selectedLessonId, userStatusOverride, invStatusOverride, inqStatusOverride,
      cohortLessonOverride, attendance, dbUserStatus, dbInvStatus, dbInqStatus, dbCohortLesson,
      toast, confirm, showToast, askConfirm, confirmYes, confirmNo, suspendUser, restoreUser,
      setInvStatus, setInqStatus, setAttendance, advanceCohortLesson, createInvitation, createCohort,
      createOrganization, assignInstructor, assignStudent, removeStudent, transferStudent, addSessionNote,
      requestAccountDeletion, dismissDeletionRequest, startLesson, setSimulationDone, saveReflection,
      setChallengeDone, completeLesson, getUser, getOrg, getCohort, cohortRoster, cohortsForInstructor,
      activeEnrollmentFor, lessonProgressFor, notesForCohort,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
