// The small confirmation page shown after an unsubscribe link is clicked.

export const UNSUBSCRIBE_MESSAGES = {
  incomplete: 'That unsubscribe link looks incomplete or invalid.',
  invalid: 'That unsubscribe link is invalid.',
  failed: 'Something went wrong processing your request. Please try again in a moment.',
  leftWaitlist: "You've left the Virtuse CFO · Verdict waitlist. We won't email you about it again.",
  leftBrief: "You've been unsubscribed from the Virtuse Brief. Sorry to see you go.",
};

export function unsubscribePage(message) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Virtuse</title></head>
<body style="margin:0;padding:0;background-color:#0d1421;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d1421;">
<tr><td align="center" style="padding:64px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px;max-width:100%;background-color:#111a2b;border:1px solid #30363d;border-radius:16px;">
<tr><td style="padding:40px 36px;text-align:center;">
<p style="margin:0 0 20px 0;font-size:22px;font-weight:800;"><span style="color:#5FAEDE;">V</span><span style="color:#e6edf3;">irtuse</span></p>
<p style="margin:0;font-size:16px;line-height:26px;color:#c3ccd6;">${message}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}
