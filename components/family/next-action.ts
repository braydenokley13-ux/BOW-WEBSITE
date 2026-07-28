/* ============================================================
 * The single "most important next action" the dashboard leads with.
 *
 * Pure function of the dashboard read model so it's easy to reason about and
 * test: priority is expiring waitlist offer > expiring seat reservation >
 * missing blocking requirement > attendance confirmation > major schedule
 * change > pending student invitation > first-session prep > feedback
 * request, exactly as specified. Only one action is ever returned — a list
 * here would just be a second stats block wearing a disguise.
 * ============================================================ */

import type { CompletedProgramRow, FamilyDashboard, RequirementRow } from "@/lib/family-portal";

export interface NextAction {
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
  urgency: "normal" | "important" | "urgent";
}

export function computeNextAction(dashboard: FamilyDashboard): NextAction | null {
  const now = Date.now();

  const soonestOffer = [...dashboard.openOffers].sort((a, b) => a.expiresAt - b.expiresAt)[0];
  if (soonestOffer) {
    return {
      title: `Seat offer for ${soonestOffer.studentName} — ${soonestOffer.programName}`,
      body: `Respond by ${new Date(soonestOffer.expiresAt).toLocaleString()} or the seat goes to the next family in line.`,
      href: `/family/offers/${soonestOffer.id}`,
      ctaLabel: "Review offer",
      urgency: "urgent",
    };
  }

  const soonestReservation = dashboard.children
    .filter((c) => c.reservationExpiresAt)
    .sort((a, b) => (a.reservationExpiresAt ?? 0) - (b.reservationExpiresAt ?? 0))[0];
  if (soonestReservation) {
    return {
      title: `Seat reserved for ${soonestReservation.studentName} — ${soonestReservation.programName}`,
      body: `Complete the remaining steps by ${new Date(soonestReservation.reservationExpiresAt as number).toLocaleString()} to keep the seat.`,
      href: "/family",
      ctaLabel: "Complete requirements",
      urgency: "urgent",
    };
  }

  const blocking = dashboard.requirementsRequiredNow[0];
  if (blocking) return blockingRequirementAction(blocking);

  const majorNotification = dashboard.notifications.find(
    (n) => n.requiresAcknowledgment && !n.acknowledgedAt && n.urgency === "urgent",
  );
  if (majorNotification) {
    return {
      title: majorNotification.title,
      body: majorNotification.body ?? "This needs your attention.",
      href: majorNotification.actionHref ?? "/family",
      ctaLabel: majorNotification.actionLabel ?? "Review",
      urgency: "urgent",
    };
  }

  const importantNotification = dashboard.notifications.find((n) => n.requiresAcknowledgment && !n.acknowledgedAt);
  if (importantNotification) {
    return {
      title: importantNotification.title,
      body: importantNotification.body ?? "This needs your attention.",
      href: importantNotification.actionHref ?? "/family",
      ctaLabel: importantNotification.actionLabel ?? "Review",
      urgency: "important",
    };
  }

  const upcomingFirstSession = dashboard.schedule.find((s) => s.sessionDate > now && s.sessionDate < now + 3 * 24 * 60 * 60 * 1000);
  if (upcomingFirstSession) {
    return {
      title: `${upcomingFirstSession.studentName}'s next session is coming up`,
      body: `${upcomingFirstSession.programName} — ${new Date(upcomingFirstSession.sessionDate).toLocaleString()}${
        upcomingFirstSession.location ? ` at ${upcomingFirstSession.location}` : ""
      }.`,
      href: "/family",
      ctaLabel: "See details",
      urgency: "normal",
    };
  }

  const feedback = firstFeedbackRequest(dashboard.completedPrograms);
  if (feedback) {
    return {
      title: `Tell us how ${feedback.studentName}'s ${feedback.programName} went`,
      body: "A quick note helps us plan the next session.",
      href: "/family",
      ctaLabel: "Share feedback",
      urgency: "normal",
    };
  }

  return null;
}

function blockingRequirementAction(req: RequirementRow): NextAction {
  return {
    title: `${req.studentName} needs one more step for ${req.programName}`,
    body: req.prompt,
    href: `/family/requirements/${req.id}`,
    ctaLabel: "Complete now",
    urgency: "important",
  };
}

function firstFeedbackRequest(programs: CompletedProgramRow[]): CompletedProgramRow | undefined {
  return programs.find((p) => !p.feedbackSubmitted && p.outcome !== "not_completed");
}
