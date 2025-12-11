export function formatMinutesToHMM(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(Number(minutes))) return '--:--'
  const total = Math.max(0, Math.floor(Number(minutes)))
  const hrs = Math.floor(total / 60)
  const mins = total % 60
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}`
  return `${mins}m`
}

export function formatSecondsToHMM(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(Number(seconds))) return '--:--'
  const totalMinutes = Math.floor(Number(seconds) / 60)
  return formatMinutesToHMM(totalMinutes)
}
