import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/site/PasswordRecoveryForms";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a secure password-reset link for your BOW account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
