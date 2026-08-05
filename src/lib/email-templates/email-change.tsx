import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { AuthShell } from './auth-shell'
import * as s from './brand'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail.
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <AuthShell
    preview="Confirm your email change for the AKCOE Portal"
    heading="Confirm your email change"
    note="If you didn't request this change, please secure your account immediately."
  >
    <Text style={s.text}>
      You requested to change the email address on your AKCOE College Management Portal account from{' '}
      <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>.
    </Text>
    <Button style={s.button} href={confirmationUrl}>
      Confirm email change
    </Button>
  </AuthShell>
)

export default EmailChangeEmail
