export const FIELD_HINTS: Record<string, string> = {
  phoneNumberId: "Meta phone number ID",
  accessToken: "Permanent system-user token",
  apiUrl: "BSP endpoint override (optional)",
  authKey: "MSG91 auth key",
  senderId: "6-char sender ID",
  flowId: "Flow/template ID (optional)",
  route: "Route: 4 = transactional",
  apiKey: "API key",
  sender: "Sender name",
  accountSid: "Twilio account SID",
  authToken: "Twilio auth token",
  from: "Twilio from number",
  host: "smtp.example.com",
  port: "587 (465 = SSL)",
  user: "SMTP username",
  password: "SMTP password",
  adAccountId: "act_<id> without prefix",
  developerToken: "Google Ads developer token",
  customerId: "Customer ID, no dashes",
  clientId: "OAuth client ID",
  clientSecret: "OAuth client secret",
  refreshToken: "OAuth refresh token",
};

export const KIND_OPTIONS: {
  channel: string;
  providers: { id: string; label: string; fields: string[] }[];
}[] = [
  {
    channel: "whatsapp",
    providers: [
      { id: "meta-cloud", label: "Meta Cloud API", fields: ["phoneNumberId", "accessToken"] },
      {
        id: "bsp",
        label: "BSP (Interakt / Gupshup / WATI / AiSensy)",
        fields: ["phoneNumberId", "accessToken", "apiUrl"],
      },
    ],
  },
  {
    channel: "sms",
    providers: [
      { id: "msg91", label: "MSG91", fields: ["authKey", "senderId", "flowId", "route"] },
      { id: "textlocal", label: "TextLocal", fields: ["apiKey", "sender"] },
      { id: "twilio", label: "Twilio", fields: ["accountSid", "authToken", "from"] },
    ],
  },
  {
    channel: "email",
    providers: [
      { id: "smtp", label: "SMTP", fields: ["host", "port", "user", "password", "from"] },
    ],
  },
  {
    channel: "meta-ads",
    providers: [
      { id: "meta-marketing", label: "Meta Marketing API", fields: ["accessToken", "adAccountId"] },
    ],
  },
  {
    channel: "google-ads",
    providers: [
      {
        id: "google-ads",
        label: "Google Ads API",
        fields: ["developerToken", "customerId", "clientId", "clientSecret", "refreshToken"],
      },
    ],
  },
];
