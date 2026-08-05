import * as React from 'react'
import { Button, Link, Text } from '@react-email/components'
import { AuthShell } from './auth-shell'
import * as s from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <AuthShell
    preview="Confirm your email for the AKCOE Portal"
    heading="Confirm your email"
    note="If you didn't create an account, you can safely ignore this email."
  >
    <Text style={s.text}>
      Thanks for signing up for the{' '}
      <Link href={siteUrl} style={s.link}>
        AKCOE College Management Portal
      </Link>
      .
    </Text>
    <Text style={s.text}>
      Please confirm your email address ({recipient}) by clicking the button below.
    </Text>
    <Button style={s.button} href={confirmationUrl}>
      Verify email
    </Button>
  </AuthShell>
)

export default SignupEmail
