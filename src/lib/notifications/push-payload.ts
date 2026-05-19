export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export function referralSignupPayload(guestName: string): PushPayload {
  return {
    title: "New referral signup",
    body: `${guestName} signed up using your referral link.`,
    url: "/profile",
    tag: "referral-signup",
  };
}

export function sessionCancelledPayload(label: string): PushPayload {
  return {
    title: "Session cancelled",
    body: `The session "${label}" has been cancelled.`,
    url: "/dashboard",
    tag: "session-cancelled",
  };
}

export function sessionUpdatedPayload(label: string): PushPayload {
  return {
    title: "Session updated",
    body: `The session "${label}" has been updated — check the new details.`,
    url: "/dashboard",
    tag: "session-updated",
  };
}
