"use client";

import { useMemo, useState } from "react";
import Simulation from "@/components/site/Simulation";
import {
  submitFeedDecision,
  completeFeedSimulation,
  signOutFeed,
  type FeedDecisionResult,
} from "@/app/actions/feed";
import { FEED_DECISIONS_TO_UNLOCK, type FeedStory, type FeedUser } from "@/lib/account";

interface FeedTerminalProps {
  user: FeedUser;
  stories: FeedStory[];
  answeredIds: string[];
}

export default function FeedTerminal({ user, stories, answeredIds }: FeedTerminalProps) {
  const [answered, setAnswered] = useState<Set<string>>(new Set(answeredIds));
  const [response, setResponse] = useState("");
  const [reveal, setReveal] = useState<FeedDecisionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [simDone, setSimDone] = useState(user.simCompleted);
  const [certId, setCertId] = useState<string | null>(user.certificateId);
  const [issuing, setIssuing] = useState(false);

  const ordered = useMemo(() => [...stories].sort((a, b) => a.ordinal - b.ordinal), [stories]);
  const decisionsCount = answered.size;
  const nextStory = ordered.find((s) => !answered.has(s.id)) ?? null;

  const phase: "story" | "sim" | "certificate" =
    simDone && certId ? "certificate" : decisionsCount >= FEED_DECISIONS_TO_UNLOCK ? "sim" : "story";

  const onSubmit = async () => {
    if (!nextStory || !response.trim() || submitting) return;
    setSubmitting(true);
    const result = await submitFeedDecision(nextStory.id, response);
    setSubmitting(false);
    if (result.ok) setReveal(result);
  };

  const onNext = () => {
    if (!nextStory) return;
    setAnswered((prev) => new Set(prev).add(nextStory.id));
    setResponse("");
    setReveal(null);
  };

  const onSimComplete = async () => {
    if (simDone || issuing) return;
    setIssuing(true);
    const result = await completeFeedSimulation();
    if (result.ok && result.certificateId) {
      setCertId(result.certificateId);
      setSimDone(true);
    }
    setIssuing(false);
  };

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh" }}>
      <FeedTicker name={user.displayName} decisionsCount={Math.min(decisionsCount, FEED_DECISIONS_TO_UNLOCK)} phase={phase} />

      <div style={{ maxWidth: phase === "sim" ? 960 : 760, margin: "0 auto", padding: phase === "sim" ? 0 : "clamp(24px,4vw,52px) clamp(18px,4vw,32px) 96px" }}>
        {phase === "story" && nextStory && (
          <StoryCard
            story={nextStory}
            index={decisionsCount + 1}
            total={FEED_DECISIONS_TO_UNLOCK}
            response={response}
            onResponse={setResponse}
            reveal={reveal}
            submitting={submitting}
            onSubmit={onSubmit}
            onNext={onNext}
            isLast={decisionsCount + 1 >= FEED_DECISIONS_TO_UNLOCK}
          />
        )}

        {phase === "sim" && (
          <div style={{ padding: "clamp(24px,4vw,40px) clamp(18px,4vw,32px) 0" }}>
            <div style={{ maxWidth: 720, margin: "0 auto 8px" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
                Unlocked · Track 101 Preview Simulation
              </span>
              <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,5vw,52px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
                You made four calls. Now run a full front office.
              </h2>
              <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.6, color: "#b9bcc4" }}>
                Three rounds, one roster, real trade-offs. Finish the debrief to earn your certificate.
              </p>
            </div>
            <Simulation
              onComplete={onSimComplete}
              completedFooter={
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-positive)" }}>
                    {issuing ? "Issuing your certificate…" : "Certificate ready — loading it up…"}
                  </span>
                </div>
              }
            />
          </div>
        )}

        {phase === "certificate" && certId && (
          <Certificate name={user.displayName} certId={certId} />
        )}

        {phase !== "sim" && (
          <div style={{ marginTop: 36, paddingTop: 18, borderTop: "1px solid var(--bow-dark-border)" }}>
            <button onClick={() => void signOutFeed()} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6d7078" }}>
              Not {user.displayName.split(" ")[0]}? Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- ticker ---------------- */
function FeedTicker({ name, decisionsCount, phase }: { name: string; decisionsCount: number; phase: string }) {
  return (
    <div style={{ borderBottom: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px clamp(18px,4vw,32px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 17, letterSpacing: "0.02em", textTransform: "uppercase" }}>BOW</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Daily Feed Terminal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}>
            {phase === "certificate" ? "Track 101 Preview · Complete" : `Decisions ${decisionsCount}/${FEED_DECISIONS_TO_UNLOCK}`}
          </span>
          <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, color: "#fff" }}>{name}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- story card ---------------- */
function StoryCard({
  story,
  index,
  total,
  response,
  onResponse,
  reveal,
  submitting,
  onSubmit,
  onNext,
  isLast,
}: {
  story: FeedStory;
  index: number;
  total: number;
  response: string;
  onResponse: (v: string) => void;
  reveal: FeedDecisionResult | null;
  submitting: boolean;
  onSubmit: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <article style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)" }}>
      {/* card header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 22px", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Story {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6d7078" }}>Sport Business Desk</span>
      </div>

      <div style={{ padding: "clamp(24px,3.5vw,36px)" }}>
        {/* headline */}
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4.6vw,48px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          {story.headline}
        </h1>
        {/* framing — editorial serif */}
        <p style={{ margin: "20px 0 0", fontFamily: "var(--font-editorial)", fontSize: "clamp(17px,1.9vw,21px)", lineHeight: 1.5, color: "#d4d6db" }}>
          {story.framing}
        </p>

        {!reveal ? (
          <>
            {/* decision prompt */}
            <div style={{ marginTop: 26, borderLeft: "4px solid var(--bow-blue)", paddingLeft: 18 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6f8bff" }}>Your decision</span>
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.45, color: "#fff" }}>
                {story.prompt}
              </p>
            </div>
            <textarea
              value={response}
              onChange={(e) => onResponse(e.target.value)}
              rows={5}
              placeholder="Make your call. Two or three sentences — what do you do, and why?"
              style={{ width: "100%", marginTop: 16, background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", color: "#fff", padding: "14px 16px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, resize: "vertical", outline: "none" }}
            />
            <button
              onClick={onSubmit}
              disabled={!response.trim() || submitting}
              style={{ marginTop: 16, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "15px 28px", border: "none", background: !response.trim() || submitting ? "var(--bow-inactive)" : "var(--bow-orange)", color: "#fff", borderRadius: 4, cursor: !response.trim() || submitting ? "not-allowed" : "pointer" }}
            >
              {submitting ? "Locking it in…" : "Submit Decision"}
            </button>
          </>
        ) : (
          <div style={{ marginTop: 26 }}>
            {/* your call, locked */}
            <div style={{ background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", borderRadius: 4, padding: "14px 16px" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Your call</span>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "#d4d6db", whiteSpace: "pre-wrap" }}>{response}</p>
            </div>

            {/* the real outcome */}
            <div style={{ marginTop: 16, borderTop: "4px solid var(--bow-positive)", border: "1px solid var(--bow-dark-border)", borderTopWidth: 4, background: "var(--bow-dark-surface)", borderRadius: 4, padding: "18px 20px" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-positive)" }}>What actually happened</span>
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.6, color: "#fff" }}>{reveal.outcome}</p>
            </div>

            {/* the concept */}
            <div style={{ marginTop: 16, background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", borderRadius: 4, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>The economics</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "#0a0a0b", background: "var(--bow-orange)", padding: "4px 10px", borderRadius: 3 }}>{reveal.concept}</span>
              </div>
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontSize: 17, lineHeight: 1.55, color: "#d4d6db" }}>{reveal.explanation}</p>
            </div>

            <button
              onClick={onNext}
              style={{ marginTop: 20, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "15px 28px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}
            >
              {isLast ? "Unlock Track 101 Preview →" : "Next Decision →"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ---------------- certificate ---------------- */
function Certificate({ name, certId }: { name: string; certId: string }) {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div style={{ paddingTop: "clamp(24px,4vw,40px)" }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-positive)" }}>Track 101 Preview · Complete</span>
      <h1 style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(34px,6vw,68px)", lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
        Nicely run, {name.split(" ")[0]}.
      </h1>
      <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 520 }}>
        You read four real stories, made the call on each, and ran a full front office. Here&apos;s your certificate.
      </p>

      {/* certificate preview */}
      <div style={{ marginTop: 28, border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", padding: "clamp(24px,4vw,40px)", textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>BOW Sports Capital</span>
        <p style={{ margin: "20px 0 0", fontFamily: "var(--font-interface)", fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a9da6" }}>This certifies that</p>
        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,5vw,52px)", lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{name}</p>
        <p style={{ margin: "16px 0 0", fontFamily: "var(--font-editorial)", fontSize: 19, color: "#d4d6db" }}>completed the</p>
        <p style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(20px,3vw,30px)", textTransform: "uppercase", letterSpacing: "-0.01em", color: "#6f8bff" }}>BOW Sports Capital Track 101 Preview</p>
        <div style={{ margin: "26px auto 0", maxWidth: 420, display: "flex", justifyContent: "space-between", gap: 16, borderTop: "1px solid var(--bow-dark-border)", paddingTop: 16 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#6d7078" }}>{date}</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#6d7078" }}>ID · {certId.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
        <a
          href="/feed/certificate?download=1"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "15px 28px", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, textDecoration: "none" }}
        >
          Download Certificate
        </a>
        <a
          href="/feed/certificate"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "15px 28px", border: "1px solid var(--bow-dark-border)", color: "#fff", borderRadius: 4, textDecoration: "none" }}
        >
          View / Print
        </a>
      </div>
    </div>
  );
}
