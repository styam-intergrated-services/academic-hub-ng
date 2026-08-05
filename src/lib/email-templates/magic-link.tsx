import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { AuthShell } from './auth-shell'
import * as s from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <AuthShell
    preview="Your sign-in link for the AKCOE Portal"
    heading="Your sign-in link"
    note="If you didn't request this link, you can safely ignore this email."
  >
    <Text style={s.text}>
      Use the button below to sign in to the AKCOE College Management Portal. This link expires
      shortly and can only be used once.
    </Text>
    <Button style={s.button} href={confirmationUrl}>
      Sign in to the portal
    </Button>
  </AuthShell>
)

export default MagicLinkEmail
