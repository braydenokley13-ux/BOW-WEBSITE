import SignUpForm from "@/components/site/SignUpForm";

export const metadata = {
  title: "Join the Interest List",
  description:
    "Not ready to register for a specific program? Join the BOW interest list and we'll follow up with the right next step.",
};

export default function SignUpPage() {
  return (
    <div data-screen-label="Sign Up">
      <SignUpForm />
    </div>
  );
}
