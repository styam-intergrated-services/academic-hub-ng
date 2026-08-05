import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { AuthShell } from './auth-shell'
import * as s from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <AuthShell
    preview="Reset your AKCOE Portal password"
    heading="Reset your password"
    note="If you didn't request a password reset, you can safely ignore this email — your password will not be changed."
  >
    <Text style={s.text}>
      We received a request to reset the password for your AKCOE College Management Portal account.
      Choose a new password using the button below.
    </Text>
    <Button style={s.button} href={confirmationUrl}>
      Reset password
    </Button>
  </AuthShell>
)

export default RecoveryEmail
