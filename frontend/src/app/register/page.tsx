import { redirect } from "next/navigation";

// Registration is no longer a separate flow — every user (new or existing)
// logs in with just their mobile number + OTP from the login page. New
// accounts are created automatically on first OTP verification, and users
// can fill in their name/email later from their profile.
export default function RegisterRedirect() {
  redirect("/login");
}
