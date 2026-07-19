import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/site/PasswordRecoveryForms";

export const metadata: Metadata = {
  title: "Choose a new password — BOW Sports Capital",
  description: "Securely choose a new password for your BOW account.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
