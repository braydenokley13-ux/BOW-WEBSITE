import { Suspense } from "react";
import SignInForm from "@/components/site/SignInForm";

export const metadata = {
  title: "Sign In — BOW Sports Capital",
  description:
    "Sign in to your program. Students, instructors, and BOW administrators run the program from one front office.",
};

export default function SignInPage() {
  return (
    <div data-screen-label="Sign In">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
