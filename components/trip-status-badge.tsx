interface TripStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-glacier text-ink-mute',
  },
  sent: {
    label: 'Sent',
    className: 'bg-brass/20 text-brass',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-spruce/20 text-spruce',
  },
  booked: {
    label: 'Booked',
    className: 'bg-success/20 text-success',
  },
  archived: {
    label: 'Archived',
    className: 'bg-paper-deep text-ink-mute',
  },
  in_progress: {
    label: 'In progress',
    className: 'bg-brass/20 text-brass',
  },
  completed: {
    label: 'Completed',
    className: 'bg-success/20 text-success',
  },
};

export function TripStatusBadge({ status }: TripStatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-paper-deep text-ink-mute',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  );
}
