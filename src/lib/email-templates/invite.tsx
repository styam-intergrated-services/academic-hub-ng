import * as React from 'react'
import { Button, Link, Text } from '@react-email/components'
import { AuthShell } from './auth-shell'
import * as s from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <AuthShell
    preview="You've been invited to the AKCOE Portal"
    heading="You've been invited"
    note="If you weren't expecting this invitation, you can safely ignore this email."
  >
    <Text style={s.text}>
      You have been invited to join the{' '}
      <Link href={siteUrl} style={s.link}>
        AKCOE College Management Portal
      </Link>
      . Accept the invitation below to set up your account.
    </Text>
    <Button style={s.button} href={confirmationUrl}>
      Accept invitation
    </Button>
  </AuthShell>
)

export default InviteEmail
