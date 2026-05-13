// apps/frontend/src/components/onboarding/Stepper.tsx
// Stepper bar component with 4 pill segments (Datos, Horario, Delivery, Agente).
// Sticky navigation with progressbar ARIA role.

const STEP_LABELS = ['Datos', 'Horario', 'Delivery', 'Agente'] as const;

interface StepperProps {
  current: number; // 0..3
}

export function Stepper({ current }: StepperProps) {
  return (
    <nav
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={current + 1}
      aria-valuetext={`Paso ${current + 1} de 4: ${STEP_LABELS[current]}`}
      className="h-14 bg-card border-b border-border flex items-center justify-center gap-md sticky top-14 z-10"
    >
      <div className="max-w-3xl mx-auto flex items-center justify-center gap-4">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
                i < current
                  ? 'text-muted-foreground'
                  : i === current
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground'
              }`}
            >
              {label}
            </button>
            {i < STEP_LABELS.length - 1 && (
              <div className="text-muted-foreground">·</div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
