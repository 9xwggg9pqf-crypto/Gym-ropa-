import { NextResponse } from 'next/server'
import { integrationStatus } from '@/lib/env'

// Sólo indica qué integraciones están configuradas (booleanos), nunca valores.
export function GET() {
  return NextResponse.json(integrationStatus())
}
