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
  onConfirm: () => void | Promise<void>;
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

  // effective status — database snapshot with server-confirmed overrides
  userStatusOf: (u: User) => UserStatus;
  invStatusOf: (iv: Invitation) => InvitationStatus;
  inqStatusOf: (iq: Inquiry) => InquiryStatus;
  cohortCurrentLessonId: (c: Cohort) => string | null;
  attendanceOf: (cohortId: string, userId: string, fallback: AttendanceState) => AttendanceState;

  // ---- mutations ----
  // status mutations: persisted first, then reflected locally
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
  fulfillDeletionRequest: (userId: string) => void;
  // student progress
  startLesson: (lessonId: string) => void;
  setSimulationDone: (lessonId: string, done: boolean) => void;
  saveReflection: (lessonId: string, text: string) => void;
  setChallengeDone: (lessonId: string, done: boolean) => void;
  completeLesson: (lessonId: string) => void;
  // self-paced unlock (Proposal 1)
  recordPodcastProgress: (lessonId: string, progress: number) => Promise<void>;
  checkAndUnlockNextLesson: (lessonId: string) => Promise<lms.UnlockResult>;
  /** Persist a reflection, then run the unlock check — ordered so there's no race. */
  saveReflectionAndCheck: (lessonId: string, text: string) => Promise<lms.UnlockResult>;

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

  // Server-confirmed overlays keep the current screen responsive after a
  // successful mutation without claiming a change that the database rejected.
  const [userStatusOverride, setUserStatusOverride] = useState<Record<string, UserStatus>>({});
  const [invStatusOverride, setInvStatusOverride] = useState<Record<string, InvitationStatus>>({});
  const [invitationTokenOverride, setInvitationTokenOverride] = useState<Record<string, string>>({});
  const [inqStatusOverride, setInqStatusOverride] = useState<Record<string, InquiryStatus>>({});
  const [cohortLessonOverride, setCohortLessonOverride] = useState<Record<string, string>>({});
  const [attendance, setAttendanceMap] = useState<Record<string, Record<string, AttendanceState>>>({});

  const [toast, setToast] = useState<Toast | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // This ref changes synchronously, unlike React state. It makes the confirm
  // button consume one pending request exactly once, even if it is double-clicked
  // before React has rendered the closed modal.
  const confirmRef = useRef<ConfirmConfig | null>(null);
  const confirmClickLockRef = useRef(false);

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

  const askConfirm = useCallback((cfg: ConfirmConfig) => {
    confirmRef.current = cfg;
    setConfirm(cfg);
  }, []);
  const confirmNo = useCallback(() => {
    if (!confirm || confirmRef.current !== confirm) return;
    confirmRef.current = null;
    setConfirm(null);
  }, [confirm]);
  const confirmYes = useCallback(() => {
    if (confirmClickLockRef.current) return;
    const pending = confirmRef.current;
    if (!pending || pending !== confirm) return;

    // Consume and close first. The callback is deliberately outside the state
    // updater so React can replay state calculations without replaying effects.
    confirmClickLockRef.current = true;
    confirmRef.current = null;
    setConfirm(null);
    try {
      const outcome = pending.onConfirm();
      if (outcome) {
        void outcome.catch(() => showToast("That action could not be completed", "negative"));
      }
    } catch {
      showToast("That action could not be started", "negative");
    } finally {
      window.setTimeout(() => {
        confirmClickLockRef.current = false;
      }, 400);
    }
  }, [confirm, showToast]);

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

  /* ---- confirmed status mutations ---- */
  const suspendUser = useCallback((id: string) => {
    void lms.suspendUser(id)
      .then(() => {
        setUserStatusOverride((m) => ({ ...m, [id]: "suspended" }));
        showToast("Access suspended", "negative");
        router.refresh();
      })
      .catch(() => showToast("Couldn't suspend — try again", "negative"));
  }, [router, showToast]);

  const restoreUser = useCallback((id: string) => {
    void lms.restoreUser(id)
      .then(() => {
        setUserStatusOverride((m) => ({ ...m, [id]: "active" }));
        showToast("Access restored");
        router.refresh();
      })
      .catch(() => showToast("Couldn't restore — try again", "negative"));
  }, [router, showToast]);

  const setInvStatus = useCallback((id: string, status: InvitationStatus) => {
    setInvStatusOverride((m) => ({ ...m, [id]: status }));
    lms.setInvitationStatus(id, status)
      .then((result) => {
        if (result.token) setInvitationTokenOverride((m) => ({ ...m, [id]: result.token! }));
        else if (status === "revoked") {
          setInvitationTokenOverride((m) => {
            const next = { ...m };
            delete next[id];
            return next;
          });
        }
        showToast(status === "pending" ? "Fresh invitation link ready to copy" : "Invitation revoked", status === "revoked" ? "negative" : "positive");
        router.refresh();
      })
      .catch(() => {
        setInvStatusOverride((m) => ({ ...m, [id]: dbInvStatus[id] ?? "revoked" }));
        showToast("Couldn't update invitation", "negative");
      });
  }, [showToast, router, dbInvStatus]);

  const setInqStatus = useCallback((id: string, status: InquiryStatus) => {
    void lms.setInquiryStatus(id, status)
      .then(() => {
        setInqStatusOverride((m) => ({ ...m, [id]: status }));
        showToast("Inquiry marked " + status);
        router.refresh();
      })
      .catch(() => showToast("Couldn't update inquiry", "negative"));
  }, [router, showToast]);

  const setAttendance = useCallback((cohortId: string, uid: string, state: AttendanceState) => {
    void lms.setAttendance(cohortId, uid, state)
      .then(() => {
        setAttendanceMap((m) => ({ ...m, [cohortId]: { ...(m[cohortId] ?? {}), [uid]: state } }));
      })
      .catch(() => showToast("Couldn't save attendance", "negative"));
  }, [showToast]);

  const advanceCohortLesson = useCallback((cohortId: string, nextLessonId: string | null) => {
    if (!nextLessonId) {
      showToast("This is the final lesson", "warning");
      return;
    }
    void lms.advanceCohortLesson(cohortId, nextLessonId)
      .then(() => {
        setCohortLessonOverride((m) => ({ ...m, [cohortId]: nextLessonId }));
        showToast("Cohort advanced to the next lesson");
        router.refresh();
      })
      .catch(() => showToast("Couldn't advance cohort", "negative"));
  }, [router, showToast]);

  /* ---- structural mutations (persist + refresh) ---- */
  const createInvitation = useCallback((input: lms.NewInvitationInput) => {
    lms.createInvitation(input)
      .then((created) => {
        if (created.token) setInvitationTokenOverride((m) => ({ ...m, [created.id]: created.token! }));
        showToast("Invitation created — copy the link now");
        router.refresh();
      })
      .catch(() => showToast("Couldn't create invitation", "negative"));
  }, [router, showToast]);

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

  const fulfillDeletionRequest = useCallback((userId: string) => {
    run(
      lms.fulfillDeletionRequest(userId),
      "Deletion request fulfilled — account identity anonymized",
      "Couldn't fulfill deletion request",
    );
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

  /* ---- self-paced unlock (Proposal 1) ---- */
  const recordPodcastProgress = useCallback(async (lessonId: string, progress: number) => {
    try {
      await lms.setPodcastProgress(lessonId, progress);
    } catch {
      /* progress is best-effort; a dropped tick will be re-sent on the next one */
    }
  }, []);

  const checkAndUnlockNextLesson = useCallback(async (lessonId: string): Promise<lms.UnlockResult> => {
    try {
      const result = await lms.checkAndUnlockNextLesson(lessonId);
      if (result.unlocked) {
        showToast("Next lesson unlocked — nice work", "positive");
        router.refresh();
      }
      return result;
    } catch {
      return { unlocked: false, nextLessonId: null, conditionsMet: false };
    }
  }, [showToast, router]);

  const saveReflectionAndCheck = useCallback(async (lessonId: string, text: string): Promise<lms.UnlockResult> => {
    try {
      // Await the write first so the unlock check sees the saved reflection.
      await lms.saveReflection(lessonId, text);
      showToast("Reflection saved");
      const result = await lms.checkAndUnlockNextLesson(lessonId);
      if (result.unlocked) showToast("Next lesson unlocked — nice work", "positive");
      router.refresh();
      return result;
    } catch {
      showToast("Couldn't save reflection", "negative");
      return { unlocked: false, nextLessonId: null, conditionsMet: false };
    }
  }, [showToast, router]);

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
      invitations: data.invitations.map((invitation) => ({
        ...invitation,
        token: invitationTokenOverride[invitation.id],
      })),
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
      invStatusOf: (iv) => {
        const status = invStatusOverride[iv.id] ?? dbInvStatus[iv.id] ?? iv.status;
        return status === "pending" && iv.expiresAt != null && iv.expiresAt <= Date.now() ? "expired" : status;
      },
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
      fulfillDeletionRequest,
      startLesson,
      setSimulationDone,
      saveReflection,
      setChallengeDone,
      completeLesson,
      recordPodcastProgress,
      checkAndUnlockNextLesson,
      saveReflectionAndCheck,
      toast,
      showToast,
      confirm,
      askConfirm,
      confirmYes,
      confirmNo,
    }),
    [
      role, me, signOut, data, selectedCohortId, selectedStudentId, selectedOrganizationId,
      selectedInquiryId, selectedLessonId, userStatusOverride, invStatusOverride, invitationTokenOverride, inqStatusOverride,
      cohortLessonOverride, attendance, dbUserStatus, dbInvStatus, dbInqStatus, dbCohortLesson,
      toast, confirm, showToast, askConfirm, confirmYes, confirmNo, suspendUser, restoreUser,
      setInvStatus, setInqStatus, setAttendance, advanceCohortLesson, createInvitation, createCohort,
      createOrganization, assignInstructor, assignStudent, removeStudent, transferStudent, addSessionNote,
      requestAccountDeletion, dismissDeletionRequest, fulfillDeletionRequest, startLesson, setSimulationDone, saveReflection,
      setChallengeDone, completeLesson, recordPodcastProgress, checkAndUnlockNextLesson, saveReflectionAndCheck,
      getUser, getOrg, getCohort, cohortRoster, cohortsForInstructor,
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
