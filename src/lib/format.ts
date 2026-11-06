export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatRate(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}×`;
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatQueueDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 min";
  }

  const minutes = Math.round(value / 60);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}
