import type { Metadata } from "next";
import JoinForm from "@/components/site/JoinForm";

export const metadata: Metadata = {
  title: "Join — Self-Paced Track 101",
  description:
    "Sign up with just your name, email, and a password and start BOW Track 101 tonight — no instructor code and no cohort required.",
  alternates: { canonical: "/join" },
};

export default function JoinPage() {
  return (
    <div data-screen-label="Join">
      <JoinForm />
    </div>
  );
}
