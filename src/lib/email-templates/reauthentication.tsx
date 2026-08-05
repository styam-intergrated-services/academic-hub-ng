import * as React from 'react'
import { Text } from '@react-email/components'
import { AuthShell } from './auth-shell'
import * as s from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <AuthShell
    preview="Your AKCOE Portal verification code"
    heading="Confirm your identity"
    note="This code expires shortly. If you didn't request it, you can safely ignore this email."
  >
    <Text style={s.text}>Use the code below to confirm your identity:</Text>
    <Text style={s.codeStyle}>{token}</Text>
  </AuthShell>
)

export default ReauthenticationEmail
