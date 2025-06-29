// Reusable icon button with tooltip
export function IconButton({ icon, onClick, label }: { icon: React.ReactNode, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-muted-foreground hover:text-primary transition-colors"
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
