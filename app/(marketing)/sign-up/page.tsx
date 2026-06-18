import SignUpForm from "@/components/site/SignUpForm";

export const metadata = {
  title: "Sign Up — BOW Sports Capital",
  description:
    "Step into the front office. Tell us who you are and what you’re interested in, and we’ll point you to the right starting line.",
};

export default function SignUpPage() {
  return (
    <div data-screen-label="Sign Up">
      <SignUpForm />
    </div>
  );
}
