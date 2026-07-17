import InstructorApplicationForm from "@/components/site/InstructorApplicationForm";

export const metadata = {
  title: "Apply to Teach — BOW Sports Capital",
  description: "Apply to become a BOW instructor and bring sports business to young people in your community.",
};

export default function ApplyToTeachPage() {
  return (
    <div data-screen-label="Apply to Teach">
      <section
        style={{
          background: "var(--bow-ink)",
          color: "#fff",
          padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)",
          minHeight: "80vh",
        }}
      >
        <div style={{ maxWidth: 620, margin: "0 auto 40px" }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--bow-orange)",
            }}
          >
            Join the coaching staff
          </span>
          <h1
            style={{
              margin: "8px 0 12px",
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: "clamp(32px,5vw,54px)",
              lineHeight: 0.96,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            Apply to Teach
          </h1>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4" }}>
            BOW instructors bring sports business to life for young people. Tell us about yourself — our leadership team
            reviews every application and follows up to schedule a conversation.
          </p>
        </div>
        <InstructorApplicationForm />
      </section>
    </div>
  );
}
