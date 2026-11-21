import { useEffect, useState } from 'react'
import { onConnectionChange, readConnection, type DevOpsConnection } from '../../devops/connection'

/** Conexão com o Azure DevOps deste aparelho, atualizada quando muda nesta ou em outra aba. */
export function useDevOpsConnection(): DevOpsConnection | null {
  const [connection, setConnection] = useState(readConnection)
  useEffect(() => onConnectionChange(() => setConnection(readConnection())), [])
  return connection
}
